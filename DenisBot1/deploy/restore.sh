#!/usr/bin/env bash
# @file: restore.sh
# @description: Откат к выбранной точке бэкапа Avaterra-бота
# @dependencies: docker, tar
# @created: 2026-05-07

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/avaterra-bot}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/avaterra-bot}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.yml}"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <timestamp>"
    echo "Available backups:"
    ls -1 "${BACKUP_DIR}" 2>/dev/null || true
    exit 1
fi

TIMESTAMP="$1"
SOURCE_DIR="${BACKUP_DIR}/${TIMESTAMP}"

if [[ ! -d "${SOURCE_DIR}" ]]; then
    echo "Backup directory not found: ${SOURCE_DIR}" >&2
    exit 1
fi

log() { echo "[restore] $*"; }

log "stopping containers"
docker compose -f "${COMPOSE_FILE}" down || true

log "restoring application directory from ${SOURCE_DIR}/app.tar.gz"
mkdir -p "${APP_DIR}"
tar -xzf "${SOURCE_DIR}/app.tar.gz" -C "$(dirname "${APP_DIR}")"

log "starting containers"
docker compose -f "${COMPOSE_FILE}" up -d

if [[ -f "${SOURCE_DIR}/postgres.sql.gz" ]]; then
    log "waiting for postgres readiness"
    sleep 8
    log "restoring postgres dump"
    gunzip -c "${SOURCE_DIR}/postgres.sql.gz" \
        | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
            psql -U "${POSTGRES_USER:-avaterra}" -d "${POSTGRES_DB:-avaterra}"
fi

log "restore completed from ${TIMESTAMP}"
