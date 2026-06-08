#!/usr/bin/env bash
# Копирует брендинг Mailcow (CSS + PNG/ SVG логотипа) на VPS и перезапускает nginx контейнер.
# Источник: infra/mail/mailcow-brand/
# На сервере (типично): MAILCOW_ROOT=/opt/mailcow-dockerized
#
# Локально (WSL): npm run mailcow:apply-branding
# Переменные: MAILCOW_ROOT, DEPLOY_SSH, DEPLOY_SSH_KEY / scripts/.deploy.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

DEPLOY_SSH="${DEPLOY_SSH:-${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}}"
MAILCOW_ROOT="${MAILCOW_ROOT:-/opt/mailcow-dockerized}"

BRAND_DIR="$ROOT_DIR/infra/mail/mailcow-brand"
CSS_SRC="$BRAND_DIR/0081-custom-mailcow.css"
LOGO_SVG_SRC="$BRAND_DIR/avaterra-login-logo.svg"
# Тот же файл, что у компонента BrandLogo на сайте (lib/brand.ts)
LOGO_PNG_SRC="$ROOT_DIR/public/images/LOGO.png"

for f in "$CSS_SRC" "$LOGO_SVG_SRC" "$LOGO_PNG_SRC"; do
  if [[ ! -f "$f" ]]; then
    echo "Нет файла: $f"
    exit 1
  fi
done

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

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
if [[ -n "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_IDENTITY")
fi

REMOTE_CSS="${MAILCOW_ROOT}/data/web/css/build/0081-custom-mailcow.css"
REMOTE_SVG="${MAILCOW_ROOT}/data/web/img/avaterra-login-logo.svg"
REMOTE_PNG="${MAILCOW_ROOT}/data/web/img/avaterra-login-logo.png"

echo "=== Mailcow branding → $DEPLOY_SSH ($MAILCOW_ROOT) ==="
if ! ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" 'echo OK && hostname'; then
  echo "SSH недоступен. Задайте ключ в scripts/.deploy.env (DEPLOY_SSH_KEY) или DEPLOY_SSH_IDENTITY."
  exit 1
fi

ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" \
  "MAILCOW_ROOT=$(printf '%q' "$MAILCOW_ROOT") bash -s" <<'REMOTE'
set -euo pipefail
mkdir -p "$MAILCOW_ROOT/data/web/css/build" "$MAILCOW_ROOT/data/web/img"
REMOTE

scp "${SSH_OPTS[@]}" "$CSS_SRC" "${DEPLOY_SSH}:${REMOTE_CSS}"
scp "${SSH_OPTS[@]}" "$LOGO_SVG_SRC" "${DEPLOY_SSH}:${REMOTE_SVG}"
scp "${SSH_OPTS[@]}" "$LOGO_PNG_SRC" "${DEPLOY_SSH}:${REMOTE_PNG}"

ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" \
  "MAILCOW_ROOT=$(printf '%q' "$MAILCOW_ROOT") bash -s" <<'REMOTE'
set -euo pipefail
cd "$MAILCOW_ROOT"
if docker compose version >/dev/null 2>&1; then
  docker compose restart nginx-mailcow
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose restart nginx-mailcow
else
  echo "Не найден docker compose — в каталоге Mailcow выполните: docker compose restart nginx-mailcow"
  exit 1
fi
echo "→ Готово. Обновите страницу входа с полной перезагрузкой без кеша (Ctrl+F5)."
REMOTE
