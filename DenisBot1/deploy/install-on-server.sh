#!/usr/bin/env bash
# @file: install-on-server.sh
# @description: Первоначальная настройка сервера: docker, каталоги, systemd, logrotate
# @dependencies: apt, systemd, docker
# @created: 2026-05-07

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/avaterra-bot}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/avaterra-bot}"

log() { echo "[install] $*"; }

if ! command -v docker >/dev/null 2>&1; then
    log "installing docker engine"
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    OS_ID="$(. /etc/os-release && echo "${ID}")"
    OS_CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-${UBUNTU_CODENAME:-bookworm}}")"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_ID} ${OS_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

mkdir -p "${APP_DIR}" "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

if [[ -f "${APP_DIR}/deploy/systemd/avaterra-bot.service" ]]; then
    log "installing systemd units"
    cp "${APP_DIR}/deploy/systemd/avaterra-bot.service" /etc/systemd/system/
    cp "${APP_DIR}/deploy/systemd/avaterra-backup.service" /etc/systemd/system/
    cp "${APP_DIR}/deploy/systemd/avaterra-backup.timer" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now avaterra-bot.service
    systemctl enable --now avaterra-backup.timer
fi

if [[ -f "${APP_DIR}/deploy/logrotate/avaterra-bot" ]]; then
    log "installing logrotate config"
    cp "${APP_DIR}/deploy/logrotate/avaterra-bot" /etc/logrotate.d/avaterra-bot
    chmod 0644 /etc/logrotate.d/avaterra-bot
fi

log "install completed"
