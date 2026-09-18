#!/usr/bin/env bash
# Run on the Linux deployment host after the Compose migration and restore check.
set -Eeuo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source "$ROOT/ops/schedule.conf"
[[ $EUID = 0 ]] || { echo 'Run as root to install systemd timers' >&2; exit 1; }
[[ "$ROOT" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Deployment path must not contain spaces or shell syntax' >&2; exit 1; }
[[ $BACKUP_RETENTION_DAYS =~ ^[1-9][0-9]*$ ]] || exit 2
id "$SERVICE_USER" >/dev/null
systemd-analyze calendar "$RESTART_ON_CALENDAR" >/dev/null
if [[ -z "$BACKUP_INTERVAL" ]]; then
  systemd-analyze calendar "$BACKUP_ON_CALENDAR" >/dev/null
  backup_schedule="OnCalendar=$BACKUP_ON_CALENDAR"
else
  [[ "$BACKUP_INTERVAL" =~ ^[1-9][0-9]*[dhw]$ ]] || { echo 'Use e.g. 10d or 1w' >&2; exit 2; }
  backup_schedule=$(printf 'OnActiveSec=%s\nOnUnitActiveSec=%s' "$BACKUP_INTERVAL" "$BACKUP_INTERVAL")
fi
for job in backup restart; do
  sed -e "s|/opt/kirokun|$ROOT|g" -e "/Type=oneshot/a User=$SERVICE_USER" "$ROOT/ops/kirokun-$job.service" > "/etc/systemd/system/kirokun-$job.service"
done
cat > /etc/systemd/system/kirokun-backup.timer <<EOF
[Unit]
Description=KIROKUN scheduled backup
[Timer]
$backup_schedule
Persistent=false
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/kirokun-restart.timer <<EOF
[Unit]
Description=KIROKUN scheduled maintenance
[Timer]
OnCalendar=$RESTART_ON_CALENDAR
Persistent=false
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable kirokun-backup.timer kirokun-restart.timer
systemctl restart kirokun-backup.timer kirokun-restart.timer
systemctl list-timers kirokun-backup.timer kirokun-restart.timer
