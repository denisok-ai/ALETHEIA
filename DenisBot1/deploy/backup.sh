#!/usr/bin/env bash
# @file: backup.sh
# @description: Бэкап текущей версии бота и БД, ротация >7 дней
# @dependencies: docker, tar, find
# @created: 2026-05-07

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/avaterra-bot}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/avaterra-bot}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.yml}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"

log() { echo "[backup] $*"; }

mkdir -p "${TARGET_DIR}"

if [[ -d "${APP_DIR}" ]]; then
    log "archiving application directory"
    tar -czf "${TARGET_DIR}/app.tar.gz" \
        --exclude="${APP_DIR}/logs" \
        --exclude="${APP_DIR}/runtime" \
        --exclude="${APP_DIR}/backups" \
        -C "$(dirname "${APP_DIR}")" \
        "$(basename "${APP_DIR}")"
fi

if command -v docker >/dev/null 2>&1; then
    if docker compose -f "${COMPOSE_FILE}" ps postgres --status running --quiet >/dev/null 2>&1; then
        log "creating postgres dump"
        docker compose -f "${COMPOSE_FILE}" exec -T postgres \
            pg_dump -U "${POSTGRES_USER:-avaterra}" -d "${POSTGRES_DB:-avaterra}" \
            | gzip -9 > "${TARGET_DIR}/postgres.sql.gz"
    else
        log "postgres container is not running, skipping db dump"
    fi
fi

log "rotating backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" \
    -print -exec rm -rf {} + || true

log "backup completed: ${TARGET_DIR}"
