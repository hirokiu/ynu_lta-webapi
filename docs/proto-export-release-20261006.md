# Proto export protection release — 2026-10-06

Scope: branch from the running API 85b722d / Web e6199a5. Apply only the tested
export changes, API resource limits, and prebuilt-image deployment guard.
Authentication, account identities, mobile routes, survey response writes,
notification settings, and Firebase configuration retain their existing behavior.
No account migration or invitations feature is introduced in this release.

Exports use a batch-size-one cursor, private disk spooling, fixed-size file reads,
and one active export per API. Japanese columns, Japan-time formatting and multi-
select expansion remain unchanged. The existing pagination does not limit an all-
survey export. New limits reject the request explicitly instead of truncating it:
128 MiB intermediate/output, 2,048 columns, 50,000 assignment IDs, and 120 seconds
of generation time. Concurrent exports receive 429 with Retry-After. Normal
completion, disconnection and handled failures remove private temporary files.
A forcibly killed process may leave temporary files until container recreation.

Existing Proto operational limits (384 MiB / 1 CPU / 256 PIDs) are retained through
Compose parameters. Build on Mac only. The rollback image remains proto-85b722d.
Rollback should use the old images with the new resource-limit configuration;
there are no database schema or data migrations to reverse.

Validation before deployment: TypeScript compile; isolated Mongo integration with
formatter parity against 85b722d; date/selection/all exports; authentication-denial;
UI export/pagination/error states; prebuilt-deployment failure tests. A backup
restore drill uses a disposable, network-isolated MongoDB limited to 512 MiB /
0.5 CPU with a 0.25 GiB WiredTiger cache, never the live database.
