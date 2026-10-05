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

## Deployment completed (2026-10-06 00:42–00:44 JST)

- Deployed API c7f2531 and Web f0b1746, images proto-export-c7f2531.
- API image SHA256: 4e28cc91a353b37672d56a98a0693a804a7f13676ab5dbb5448a8f42e5a54b6d.
- Web image SHA256: 97b1c755d18e1bebbcf84a0e219caeda79b6c2cb14589f51840a6a52b2ce81a4.
- Transfer archive SHA256: bf610867f9ca5776bef661d7dfa8098dbb47aa1ef54fd603094729cb37d2c56c.
- Backup survey-20261005T153945Z-91038.archive.gz restored successfully into a
  disposable database: 8,946 documents, zero failures, all collection counts matched.
- Deployment also created survey-20261005T154157Z-93547.archive.gz immediately
  before replacement. This second archive passed gzip/checksum checks; the first
  archive is the one with a completed restore drill. Both remain on the new server.
- Actual deployment image passed 24,000-row synthetic export under 384 MiB/1 CPU:
  98,460,901 output bytes, approximately 112 MiB peak RSS, cancellation/concurrency/
  failure-cleanup tests passed. No stress test was run on the live server.
- Before/after manifests are private files on the server under
  ~/kirokun-proto/ops/state/proto-export-{before,after}-20261006.json.
- CSV and JSON hashes match for all 56 surveys: 2,650 nonempty answers,
  420,002 CSV bytes. All 4,651 assignment-result records remain, including empty ones.
- DB counts unchanged: assignments 4,182; assignmentresults 4,651; groups 12;
  surveys 56; users 45.
- Firebase UID/email/disabled/provider identity digests unchanged for hiroki_u,
  hanzawa and hasegawa. Authentication used the authorized hiroki_u account; this
  is not a claim that the researchers' passwords were used or tested.
- Existing mobile GET /api/users/hiroki_u/allassignments returned the identical
  payload (47 assignments). Live answer submission and push sending were not
  exercised. Notification/preparation settings and their code were not changed.
- Both Proto containers healthy with zero restarts after deployment, API limit
  384 MiB retained. Dev remains healthy on dev-export-439d603; host guard active
  with zero restarts. Proto public HTTPS health returned 200, host available
  memory approximately 1,150 MiB.

## Rollback

On ~/kirokun-proto, change only RELEASE_ID in .env back to proto-85b722d,
retaining API_MEMORY_LIMIT=384m and API_CPU_LIMIT=1.0. Then use
`docker compose --env-file .env -f compose.yaml up -d --no-build --pull never --wait api web`.
Keep both old images available. Verify public health and record the rollback.
The checked-out code will then differ from the image version: explicitly record
that state before the next deployment. Do not restore the database for this code
rollback; that would discard legitimate changes made since the backup.

Next phase: invitation/password-reset and mobile compatibility work remain on the
separate feature branch / Dev environment. Legacy domain removal is not part of
this release. Do not treat this deployment as final server migration completion.
