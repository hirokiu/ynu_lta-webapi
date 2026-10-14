#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
# Only dedicated, ephemeral local containers; no real Firebase credentials or survey data.
for name in kirokun-lab-a kirokun-lab-b; do
  if docker container inspect "$name" >/dev/null 2>&1; then echo "Refusing existing container $name" >&2; exit 1; fi
done
cleanup() { docker rm -fv kirokun-lab-a kirokun-lab-b >/dev/null 2>&1 || true; }
trap cleanup EXIT
for entry in a:37031 b:37032; do
  side=${entry%:*}; port=${entry#*:}
  docker run --rm -d --name "kirokun-lab-$side" --memory 512m --cpus 0.5 -p "127.0.0.1:$port:27017" mongo:4.2.24 --wiredTigerCacheSizeGB 0.25 >/dev/null
  for attempt in $(seq 1 30); do
    if docker exec "kirokun-lab-$side" mongo --quiet --eval 'quit(db.adminCommand("ping").ok?0:1)' >/dev/null 2>&1; then break; fi
    sleep 1
  done
done
node test/project-isolation/run.js
