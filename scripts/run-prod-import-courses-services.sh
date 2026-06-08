#!/usr/bin/env bash
# Однократный импорт курсов и витрины на прод (после deploy:rsync). Запуск из WSL:
#   bash scripts/run-prod-import-courses-services.sh
set -euo pipefail
DEPLOY_SSH="${DEPLOY_SSH:-root@95.181.224.70}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
REMOTE_JSON="${DEPLOY_ROOT}/prisma/data/courses-services-sync.json"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
if [[ -z "${DEPLOY_SSH_IDENTITY:-}" && -n "${DEPLOY_SSH_KEY:-}" ]]; then
  DEPLOY_SSH_IDENTITY="$DEPLOY_SSH_KEY"
fi
if [[ -z "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  if [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_deploy_nopass"
  elif [[ -f "$HOME/.ssh/avaterra_pro_root" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_pro_root"
  fi
fi
if [[ -n "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_IDENTITY")
fi

echo "=== Импорт на $DEPLOY_SSH:$REMOTE_JSON ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "DEPLOY_ROOT='$DEPLOY_ROOT' REMOTE_JSON='$REMOTE_JSON' bash -se" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_ROOT"
test -f "$REMOTE_JSON" || { echo "Нет файла $REMOTE_JSON — сначала deploy:rsync"; exit 1; }
sudo systemctl stop aletheia.service || true
npx tsx scripts/import-courses-and-services-merge.ts "$REMOTE_JSON"
sudo systemctl restart aletheia.service
sudo systemctl is-active aletheia.service
REMOTE
echo "=== Готово ==="
