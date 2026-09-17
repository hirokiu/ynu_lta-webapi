#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
source /etc/os-release
[[ $ID == debian && $VERSION_ID == 12 ]] || { echo 'This script targets Debian 12'; exit 1; }
id hiroki_u >/dev/null
apt-get update
apt-get install -y ca-certificates curl git util-linux
install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --location https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: bookworm
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker hiroki_u
install -d -o hiroki_u -g "$(id -gn hiroki_u)" -m 0750 /opt/kirokun-staging
install -d -o hiroki_u -g "$(id -gn hiroki_u)" -m 0700 /opt/kirokun-secrets
systemctl is-active docker
docker compose version
printf 'Setup complete. Reconnect SSH before running Docker as hiroki_u.\n'
