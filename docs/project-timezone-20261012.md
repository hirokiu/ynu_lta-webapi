# Project timezone and navigation — 2026-10-12

## Behavior

- Navigation keeps KIROKUN on the left and shows project display name, authenticated username and current time on the right. Clock updates every second, using the browser clock converted into the project timezone.
- Settings stores an IANA timezone shared by the project, defaulting to Asia/Tokyo for existing records. Name and timezone use the same revision check and audit history. Older clients omitting timezone preserve its current value.
- Admin display dates, answer export dates and date-range boundaries use that setting. CSV/JSON answer timestamps include a numeric UTC offset (`YYYY-MM-DD HH:mm:ss Z`) to distinguish daylight-saving transitions. Existing answer columns and selection semantics remain unchanged. Template JSON has no date fields and is unchanged.
- Each export snapshots the timezone once. Database timestamps and existing scheduled instants remain unchanged. New one-time/group-series schedules use the project zone. Individual recurring schedules retain the participant's timezone, explicitly explained in the form.
- A saved setting applies immediately in the current admin session. Other open sessions should reload. This change does not change mobile display-time policy or server maintenance timers (03:00/03:30 Japan time).

## Validation

- API build and Web production build.
- Isolated MongoDB project-settings integration: permissions, invalid timezone, revision conflicts, audit, legacy-client compatibility, project separation, group scheduling across DST.
- CSV/JSON integration: Tokyo fallback, New York winter/summer conversion, existing full/selected/period exports.
- Web time helper: offsets, invalid-zone fallback and 23-hour DST date range.
- Existing notification integration tests pass without contacting Firebase or sending real notifications.

## Deployment

Target: Proto only. Build images on Mac (linux/amd64); back up before deploying. Release tag: proto-timezone-20261012. Existing production survey data, authentication and notification settings are retained.
