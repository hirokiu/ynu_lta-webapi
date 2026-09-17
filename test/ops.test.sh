#!/usr/bin/env bash
# Exercise maintenance failures without Docker or production credentials.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/app/ops" "$tmp/bin"
cp "$root/ops/manage.sh" "$root/ops/counts.js" "$root/ops/schedule.conf" "$tmp/app/ops/"
cat > "$tmp/bin/flock" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$tmp/bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$OPS_TEST_LOG"
if [[ "$*" == *'ps --status running -q api'* ]]; then echo test-api; fi
if [[ "$*" == *mongodump* ]]; then
  if [[ ${FAIL_DUMP:-false} = true ]]; then exit 8; fi
  printf 'synthetic archive' | gzip
fi
if [[ "$*" == *'mongo --quiet Survey'* ]]; then echo '{"surveys":1}'; fi
EOF
cat > "$tmp/bin/sha256sum" <<'EOF'
#!/bin/sh
shasum -a 256 "$@"
EOF
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" OPS_TEST_LOG="$tmp/log"
FAIL_DUMP=true "$tmp/app/ops/manage.sh" backup && exit 1
rg -q 'start api' "$tmp/log"
test -z "$(find "$tmp/app/backups" -name '*.partial')"
: > "$tmp/log"
old="$tmp/app/backups/survey-20000101T000000Z-1.archive.gz"
touch -t 200001010000 "$old"
touch "$tmp/app/backups/survey-verified.archive.gz.verified"

"$tmp/app/ops/manage.sh" restart
test ! -f "$old"
rg -q 'restart -t 60 mongodb' "$tmp/log"
rg -q 'restart -t 60 web' "$tmp/log"
rg -q 'wget -q --spider' "$tmp/log"
echo 'Maintenance failure recovery and restart sequencing passed (mock Docker)'
