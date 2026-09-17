#!/usr/bin/env bash
# Restore into a disposable, network-isolated database, never the active database.
set -Eeuo pipefail
umask 077
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
archive=${1:?Pass the absolute path to a backup archive}
[[ "$archive" = /* && -f "$archive" && -f "$archive.counts.json" ]] || { echo "Archive and counts manifest required" >&2; exit 2; }
(cd "$(dirname -- "$archive")" && sha256sum -c "$(basename -- "$archive").sha256")
name="kirokun-restore-check-$$"
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "$name" --network none mongo:4.2.24 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$name" mongo --quiet --eval 'quit(db.adminCommand("ping").ok ? 0 : 1)' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec -i "$name" mongorestore --archive --gzip < "$archive"
actual=$(docker exec -i "$name" mongo --quiet Survey < "$ROOT/ops/counts.js")
expected=$(cat "$archive.counts.json")
[[ "$actual" = "$expected" ]] || { echo "Restored collection counts do not match" >&2; exit 1; }
touch "$archive.verified"
echo "Restore and collection counts verified"
