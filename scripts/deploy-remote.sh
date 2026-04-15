#!/usr/bin/env bash
# Деплой на прод по SSH (WSL/Linux). Соответствует docs/Production-Server.md:
# каталог /opt/ALETHEIA, перезапуск aletheia (PM2 или systemd).
# На сервере вызывается scripts/deploy-pull.sh — один источник правды с ручным деплоем.
#
# Локально: scripts/.deploy.env (см. .deploy.env.example), ключ без passphrase для CI.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_pro_root}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/ALETHEIA}"

if [[ ! -f "$KEY" ]]; then
  echo "Нет ключа: $KEY"
  exit 1
fi

echo "→ SSH $USER@$HOST (приоритет каталога: $REMOTE_DIR)"

REMOTE_DIR_Q=$(printf '%q' "$REMOTE_DIR")

# SKIP_NGINX_CACHE=1 — не чистить proxy_cache nginx (редко; см. scripts/deploy-pull.sh).
ssh -i "$KEY" -o IdentitiesOnly=yes -o ConnectTimeout=30 "${USER}@${HOST}" \
  "REMOTE_DIR=$REMOTE_DIR_Q GIT_BRANCH=${GIT_BRANCH:-main} SKIP_NGINX_CACHE=${SKIP_NGINX_CACHE:-0} bash -s" <<'REMOTE'
set -euo pipefail
candidates=("$REMOTE_DIR" /opt/ALETHEIA /srv/avaterra /var/www/avaterra)
TARGET=""
for d in "${candidates[@]}"; do
  [[ -n "$d" ]] || continue
  if [[ -f "$d/scripts/deploy-pull.sh" ]]; then
    TARGET="$d"
    break
  fi
done
if [[ -z "$TARGET" ]]; then
  for d in "${candidates[@]}"; do
    [[ -n "$d" ]] || continue
    if [[ -f "$d/package.json" ]] && [[ -d "$d/.git" ]]; then
      TARGET="$d"
      break
    fi
  done
fi
if [[ -z "$TARGET" ]]; then
  echo "Не найден каталог приложения (ожидали deploy-pull.sh или git+package.json)."
  echo "Проверьте DEPLOY_REMOTE_DIR в scripts/.deploy.env (прод: обычно /opt/ALETHEIA)."
  exit 1
fi

cd "$TARGET"
export DEPLOY_ROOT="$TARGET"
echo "→ Деплой из: $(pwd) (ветка: ${GIT_BRANCH})"

if [[ -f scripts/deploy-pull.sh ]]; then
  bash scripts/deploy-pull.sh
else
  echo "(!) Нет scripts/deploy-pull.sh — упрощённый путь"
  git fetch origin "$GIT_BRANCH"
  git reset --hard "origin/$GIT_BRANCH"
  npm ci
  npx prisma migrate deploy
  rm -rf .next
  npm run build:server 2>/dev/null || npm run build
  if systemctl is-active --quiet aletheia.service 2>/dev/null; then
    sudo systemctl restart aletheia.service
  elif command -v pm2 >/dev/null 2>&1; then
    pm2 restart aletheia 2>/dev/null || pm2 restart avaterra 2>/dev/null || pm2 restart all 2>/dev/null || true
  fi
fi
echo "→ Готово."
REMOTE
