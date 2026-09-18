#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"
source ops/schedule.conf
[[ $BACKUP_RETENTION_DAYS =~ ^[1-9][0-9]*$ ]] || { echo "Invalid retention days" >&2; exit 2; }
mkdir -p ops/state backups
exec 9>ops/state/maintenance.lock
flock -w 3600 9 || { echo "Another maintenance operation is running" >&2; exit 1; }
compose() { docker compose --env-file .env -f compose.yaml "$@"; }
wait_api() {
  for attempt in $(seq 1 60); do
    if compose exec -T api node -e 'require("http").get("http://127.0.0.1:9001/api/health",r=>process.exit(r.statusCode===200?0:1)).on("error",()=>process.exit(1))' >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echo "API did not become healthy" >&2
  return 1
}
resume_api=false
partial=""
cleanup() {
  local status=$?
  if $resume_api; then compose start api || status=1; fi
  if [[ -n "$partial" ]]; then rm -f -- "$partial"; fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
backup() {
  # This standalone database has no oplog snapshot: stop the only writer.
  [[ -n $(compose ps --status running -q api) ]] || { echo "API must be running before backup" >&2; return 1; }
  resume_api=true
  compose stop -t 60 api
  local name="survey-$(date -u +%Y%m%dT%H%M%SZ)-$$.archive.gz"
  partial="$ROOT/backups/$name.partial"
  compose exec -T mongodb mongodump --db Survey --archive --gzip > "$partial"
  compose exec -T mongodb mongo --quiet Survey < ops/counts.js > "$ROOT/backups/$name.counts.json"
  test -s "$partial"
  gzip -t "$partial"
  mv -- "$partial" "$ROOT/backups/$name"
  partial=""
  (cd backups && sha256sum "$name" > "$name.sha256")
  compose start api
  wait_api
  resume_api=false
  echo "Backup completed: $name"
  # Only prune this application's complete old archives after a new successful dump.
  # Keep at least one independently verified restore within the retention window.
  if find backups -maxdepth 1 -name 'survey-*.archive.gz.verified' -mtime -"$BACKUP_RETENTION_DAYS" -print -quit | grep -q .; then
    while IFS= read -r -d '' old; do
      rm -f -- "$old" "$old.sha256" "$old.counts.json" "$old.verified"
    done < <(find backups -maxdepth 1 -type f -name 'survey-*.archive.gz' -mtime +"$BACKUP_RETENTION_DAYS" -print0)
  else
    echo "Retention cleanup skipped: verify a recent backup first" >&2
  fi
}
case "${1:-}" in
  build)
    git submodule update --init --recursive
    compose build api web
    ;;
  deploy)
    [[ -z $(git status --porcelain --untracked-files=no) ]] || { echo "Commit changes before deploying" >&2; exit 1; }
    git submodule update --init --recursive
    compose build api web
    if [[ -n $(compose ps --status running -q api) ]]; then backup; fi
    compose up -d --wait --wait-timeout 180
    git rev-parse HEAD > ops/state/deployed-commit
    ;;
  backup) backup ;;
  restart)
    backup
    # Weekly restart includes MongoDB; stop writers first and wait for DB readiness.
    resume_api=true
    compose stop -t 60 api
    compose restart -t 60 mongodb
    for attempt in $(seq 1 60); do
      if compose exec -T mongodb mongo --quiet --eval 'quit(db.adminCommand("ping").ok ? 0 : 1)' >/dev/null; then break; fi
      sleep 2
    done
    compose exec -T mongodb mongo --quiet --eval 'quit(db.adminCommand("ping").ok ? 0 : 1)' >/dev/null
    compose start api
    resume_api=false
    compose restart -t 60 web
    wait_api
    compose exec -T web wget -q --spider http://127.0.0.1/
    ;;
  indexes) compose exec -T mongodb mongo --quiet Survey < ops/indexes.js ;;
  status) compose ps ;;
  *) echo "Usage: $0 {build|deploy|backup|restart|indexes|status}" >&2; exit 2 ;;
esac
