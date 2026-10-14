#!/bin/bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
SOURCE=$(cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null
[[ -x /usr/bin/docker ]]
install -o root -g root -m 755 "$SOURCE/host-guard.py" /usr/local/sbin/kirokun-host-guard
install -d -m 750 /var/lib/kirokun-host-guard
cat > /etc/systemd/system/kirokun-host-guard.service <<'EOF'
[Unit]
Description=KIROKUN host memory pressure protection
After=docker.service
[Service]
ExecStart=/usr/bin/python3 /usr/local/sbin/kirokun-host-guard
Restart=on-failure
RestartSec=10
MemoryMax=96M
CPUQuota=10%
CPUWeight=1000
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/kirokun-host-guard
[Install]
WantedBy=multi-user.target
EOF
# Applied without restarting SSH; persisted by systemd.
systemctl set-property ssh.service MemoryLow=64M CPUWeight=1000
systemctl daemon-reload
systemctl enable --now kirokun-host-guard.service
systemctl --no-pager status kirokun-host-guard.service
