#!/usr/bin/env bash
# Безопасная сборка на проде: distDir=.next-new, swap только после успеха.
# Запуск на сервере: cd /opt/ALETHEIA && bash scripts/safe-prod-build.sh
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
cd "$DEPLOY_ROOT"

export NEXTAUTH_URL="${NEXTAUTH_URL:-https://avaterra.pro}"
export BUILD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || true)"
export NEXT_DIST_DIR=.next-new

test -f components/ui/PasswordInput.tsx && echo "PASSWORD_INPUT=EXISTS" || {
  echo "PASSWORD_INPUT=MISSING — abort"
  exit 1
}

if systemctl is-active --quiet aletheia.service; then
  echo "Stopping aletheia during build..."
  systemctl stop aletheia.service
  RESTART_ALETHEIA=1
else
  RESTART_ALETHEIA=0
fi

rm -rf .next-new
# devDeps (tailwindcss, postcss, typescript) нужны для сборки. NODE_ENV не задаём до npm ci,
# иначе npm пропустит devDependencies и сборка упадёт на «Cannot find module 'tailwindcss'».
echo "npm ci --include=dev (tailwind/postcss/typescript для сборки)..."
npm ci --include=dev
echo "Starting build to .next-new..."
export NODE_ENV=production
if ! npm run build:server; then
  echo "BUILD_FAILED"
  rm -rf .next-new
  if [[ "${RESTART_ALETHEIA:-0}" = "1" ]]; then
    echo "Restarting aletheia with previous .next..."
    systemctl start aletheia.service
  fi
  exit 1
fi

if [[ ! -f .next-new/BUILD_ID ]]; then
  echo "ABORT: no .next-new/BUILD_ID (NEXT_DIST_DIR unsupported?)"
  rm -rf .next-new
  exit 2
fi

echo "BUILD_TO_NEXT_NEW=OK"
if [[ -d .next ]]; then
  mv .next ".next-old-$(date +%Y%m%d%H%M%S)"
fi
mv .next-new .next
echo "SWAPPED_NEXT=OK"

if [[ "${RESTART_ALETHEIA:-0}" = "1" ]] || ! systemctl is-active --quiet aletheia.service; then
  systemctl restart aletheia.service
fi
sleep 5
systemctl is-active aletheia.service
curl -sS -o /dev/null -w 'HEALTH=%{http_code}\n' https://avaterra.pro/api/health
systemctl is-active aletheia-telegram-poll.service
npx tsx scripts/telegram-webhook-info.ts 2>&1 | grep -E 'url|pending' || true
