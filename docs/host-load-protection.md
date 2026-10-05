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

## Pending administrator installation

Files host-guard.py and install-host-guard.sh are placed in hiroki_u's home.
Run `sudo bash ~/install-host-guard.sh` on uva.alchembright.com.
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
CSV exports still collect results in memory. Implement streaming/bounded batches,
concurrency limits and export memory telemetry before calling that risk resolved.
Add an explicitly agreed external alert channel, and assess RAM upgrade/swap based
on measurements. Do not intentionally exhaust RAM on the live server.

Tests: synthetic sustained/transient pressure, Dev-first stopping and strict
container identity checking (3 passing tests). Installer shell syntax checked.
