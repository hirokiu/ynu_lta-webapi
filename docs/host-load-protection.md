# Host load protection — 2026-10-05

## Status

The 2 GB / 3 CPU host has no swap. Both APIs previously had no resource limits.
Applied without restarting containers:

| API | Hard RAM limit (no swap) | CPU quota | PID limit |
| --- | --- | --- | --- |
| Dev | 256 MiB | 0.75 CPU | 256 |
| Proto | 384 MiB | 1 CPU | 256 |

Both remain healthy and local API health endpoints return 200. Limits are also saved
in each live compose.yaml; original files are preserved as compose.yaml.before-host-guard.
These are intentional operational changes: reconcile them when updating those checkouts,
rather than overwriting or treating them as application-source conflicts.
Repository Compose uses configurable defaults of 384m/1.0; set Dev to 256m/0.75.
No database limits or database restarts were performed. No host stress test was run.

## Administrator installation confirmed

Files host-guard.py and install-host-guard.sh are placed in hiroki_u's home.
Administrator ran `sudo bash ~/install-host-guard.sh` on uva.alchembright.com.
Verified active/running, NRestarts=0, MemoryCurrent about 7 MiB, and SSH MemoryLow=64M / CPUWeight=1000.
Detailed journal and private status content require sudo; they were not read from the unprivileged session.
Installer copies root-owned code, enables a systemd service, and assigns SSH
MemoryLow=64M and CPUWeight=1000 without restarting SSH.
MemoryLow is best-effort cgroup protection, not a guarantee against every failure.

Every 5 seconds the guard checks host MemAvailable, records load averages and
writes /var/lib/kirokun-host-guard/status.json. It logs at least every minute.
Below 512 MiB is a warning. Below 256 MiB continuously for 30 seconds causes
Dev API to stop first. If pressure persists for another 30 seconds, Proto API
stops. Exact Compose project/service labels are checked before stopping.
It never stops MongoDB, web, gateway, or SSH and never automatically restarts APIs.
A failed measurement/inspection resets the pressure counter and logs an error.
Incident files rotate at 1 MiB, retaining one previous file.

Emergency API stops temporarily prevent login, submissions, and API operations.
An API exceeding its hard limit may be killed/restarted by Docker; retrying a
failed export without reducing its workload can repeat the failure.
No remote alert destination has been configured. Journal/status logging alone
is not a substitute for external uptime alerts. Existing Zabbix delivery remains
unverified. CPU load is recorded; sustained CPU alone does not trigger stops.

## Verification and recovery

- `systemctl status kirokun-host-guard`
- `journalctl -u kirokun-host-guard --since '1 hour ago'`
- `sudo cat /var/lib/kirokun-host-guard/status.json`
- `docker stats --no-stream`
- After identifying the source of pressure and confirming sufficient free RAM,
  start only the stopped API with `docker start kirokun-dev-api-1` or
  `docker start kirokun-proto-api-1` and check health.
- To disable guard: `sudo systemctl disable --now kirokun-host-guard`.
  Container limits remain in place. Do not remove them merely to retry a large export.

## Remaining work

Host-side builds are already rejected below 4 GiB available RAM. Build images on
Mac and deploy prebuilt images. Container limits plus the guard reduce risk but
cannot guarantee SSH availability during kernel, disk, network or database failures.
MongoDB and other host workloads still need measured capacity planning.
CSV/JSON export now uses a batch-size-one database cursor and bounded disk-backed
rows, then streams a completed file. One export per API is allowed; overlapping
requests receive 429 with Retry-After. Capacity limits: 128 MiB intermediate/output,
2,048 columns, 50,000 assignment IDs and 120 seconds generation time. These produce
an explicit error, never a silently truncated download. The old 10,000-result cap
is removed. Files are deleted on completion, cancellation and handled errors; an
OS kill may leave private temporary files until container recreation.
The legacy export endpoints use the same guard. CSV formatting parity and selection/
date filters are tested. A 24,000-row synthetic export (about 94 MiB) completed
with a 64 MiB JS heap and about 140 MiB peak process RSS on Mac; this is not a
measurement of peak memory for every production survey. Real export telemetry logs
row count, byte count, elapsed time and final RSS, excluding answer contents.
Tests cover concurrency rejection, client disconnect and database-error cleanup.
Add an explicitly agreed external alert channel, and assess RAM upgrade/swap based
on measurements. Do not intentionally exhaust RAM on the live server.

Tests: synthetic sustained/transient pressure, Dev-first stopping and strict
container identity checking (3 passing tests). Installer shell syntax checked.

## Dev deployment verification (2026-10-05, 23:45 JST)

- API code 439d603, Web code ecbce2a; both images tagged dev-export-439d603.
- API image: 29acba3af667e478675642f15d70836aeb5dcd9e001d83848c1d94dc3392f1d1.
- Web image: c1292a6e453f5ddd4f1d75db1ff801169782fe29fb16cbaa24ac4e4f52c76241.
- Pre-deployment backup: survey-20261005T144435Z-46681.archive.gz (gzip/checksum
  verified; this particular archive has not yet undergone a restore drill).
- Transfer archive SHA256: bec13fcbe5034cb4f5d2ce5d35b5445c9976823c957f3e49581d9acce148fded.
- Images built on Mac, loaded on server, deployed without host builds.
- The exact API image passed the synthetic 24,000-row / 98,460,901-byte CSV test
  with a 256 MiB memory limit and 1 CPU, using default Node settings: peak RSS
  about 111 MiB. Also passed with a 64 MiB JS heap. This tests the export helper
  with synthetic records; database integration was tested separately on local Mongo.
- Dev real Firebase admin authentication and CSV/JSON export for all six existing
  surveys succeeded. These Dev surveys currently have no saved answers; no new
  answers were inserted for this check. Nonempty/large-answer coverage is synthetic.
- Dev API healthy, restart count zero, 256 MiB / 0.75 CPU limits retained.
- Host guard active with zero restarts, host available memory about 1,188 MiB.
- Proto remains on proto-85b722d, healthy, HTTPS health 200. Its existing restart
  count remains one (the earlier post-reboot Mongo connection failure).
- Repo resource settings are now parameterized; Dev limits are in .env. The
  temporary operational Compose edit was reconciled exactly before fast-forward.
- Proto export implementation is not yet updated. Apply a narrowly scoped export
  release after review; do not accidentally enable account migration as part of it.
- Build still reports existing legacy dependency vulnerabilities and Web bundle
  size warnings. This export fix is not a dependency upgrade.
