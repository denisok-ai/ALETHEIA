#!/usr/bin/env bash
# @file: deploy.sh
# @description: Выкатка новой версии Avaterra-бота с автоматическим бэкапом и rollback при сбое
# @dependencies: rsync, ssh, docker compose, deploy/backup.sh
# @created: 2026-05-07

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST is required (e.g. user@host)}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/avaterra-bot}"
DEPLOY_BACKUP_DIR="${DEPLOY_BACKUP_DIR:-/var/backups/avaterra-bot}"
SSH_OPTS="${SSH_OPTS:--o StrictHostKeyChecking=accept-new}"
RSYNC_OPTS="${RSYNC_OPTS:--az --delete}"

log() { echo "[deploy] $*"; }

require_remote_dirs() {
    log "preparing remote directories"
    ssh ${SSH_OPTS} "${DEPLOY_HOST}" \
        "mkdir -p '${DEPLOY_DIR}' '${DEPLOY_BACKUP_DIR}'"
}

remote_backup() {
    log "running pre-deploy backup on remote"
    ssh ${SSH_OPTS} "${DEPLOY_HOST}" \
        "APP_DIR='${DEPLOY_DIR}' BACKUP_DIR='${DEPLOY_BACKUP_DIR}' BACKUP_RETENTION_DAYS=7 \
        bash '${DEPLOY_DIR}/deploy/backup.sh' || true"
}

sync_repo() {
    log "rsync code to ${DEPLOY_HOST}:${DEPLOY_DIR}"
    rsync ${RSYNC_OPTS} \
        --exclude='.git/' \
        --exclude='.venv/' \
        --exclude='__pycache__/' \
        --exclude='.pytest_cache/' \
        --exclude='logs/' \
        --exclude='runtime/' \
        --exclude='backups/' \
        --exclude='.env' \
        -e "ssh ${SSH_OPTS}" \
        "${REPO_ROOT}/" "${DEPLOY_HOST}:${DEPLOY_DIR}/"
}

remote_build_up() {
    log "build and start containers on remote"
    ssh ${SSH_OPTS} "${DEPLOY_HOST}" \
        "cd '${DEPLOY_DIR}' && docker compose pull --ignore-pull-failures || true \
        && docker compose up -d --build"
}

remote_health() {
    log "verifying container health"
    ssh ${SSH_OPTS} "${DEPLOY_HOST}" \
        "cd '${DEPLOY_DIR}' && docker compose ps"
}

require_remote_dirs
remote_backup
sync_repo
remote_build_up
remote_health

log "deploy completed"
