#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
compose() { docker compose --env-file .env -f compose.yaml "$@"; }
[[ ${1:-} == list || ${1:-} == requeue ]] || exit 2
exec 9>ops/state/maintenance.lock
flock -w 60 9
if [[ $1 == requeue ]]; then
  [[ -z $(compose ps --status running -q api) ]] || { echo 'Stop API before reviewing requeue'; exit 2; }
fi
compose run --rm --no-deps -T --entrypoint node \
  -e KIROKUN_SCHEDULER_STOPPED=true -e NODE_PATH=/app/node_modules \
  -v "$PWD/ops:/review:ro" api /review/proto-notification-review.js "$@"
