#!/usr/bin/env bash
# Отправка main на GitHub и деплой на VPS (см. docs/Production-Server.md).
# Запуск из WSL в корне проекта: bash scripts/push-and-deploy-prod.sh
# Или: npm run deploy:prod
#
# Требуется: git push в origin (HTTPS/PAT или SSH remote), SSH-ключ для прод
# (~/.ssh/avaterra_pro_root или scripts/.deploy.env — см. scripts/deploy-remote.sh).
#
# SKIP_GIT_COMMIT=1 — не коммитить, только push текущей ветки.
# DEPLOY_COMMIT_MSG="..." — сообщение коммита при наличии изменений.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Ожидалась ветка main, сейчас: $BRANCH. Переключитесь или задайте вручную."
  exit 1
fi

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  if [[ "${SKIP_GIT_COMMIT:-}" == "1" ]]; then
    echo "Есть незакоммиченные изменения и SKIP_GIT_COMMIT=1 — сначала закоммитьте или уберите флаг."
    exit 1
  fi
  echo "→ git add -A && commit"
  git add -A
  git commit -m "${DEPLOY_COMMIT_MSG:-feat(landing): ТЗ AVATERRA — тексты, программа, FAQ, витрина, seed}"
fi

echo "→ git push origin main"
git push origin main

echo "→ npm run deploy:remote"
npm run deploy:remote

echo "→ Готово. Проверка: curl -sI https://avaterra.pro/ | head -5"
