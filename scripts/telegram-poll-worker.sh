#!/usr/bin/env bash
# Гибридный getUpdates fallback (каждые 30s через cron).
# */1 * * * * root flock -n /run/aletheia-telegram-poll.lock /opt/ALETHEIA/scripts/telegram-poll-worker.sh
# */1 * * * * root sleep 30; flock -n /run/aletheia-telegram-poll.lock /opt/ALETHEIA/scripts/telegram-poll-worker.sh
set -euo pipefail
cd /opt/ALETHEIA
set -a
# shellcheck disable=SC1091
source .env
set +a
export TELEGRAM_POLL_STATE_DIR="${TELEGRAM_POLL_STATE_DIR:-/var/lib/aletheia}"
mkdir -p "$TELEGRAM_POLL_STATE_DIR"
exec flock -n /run/aletheia-telegram-poll.lock \
  npx tsx scripts/telegram-poll-worker.ts >> /var/log/telegram-poll-worker.log 2>&1
