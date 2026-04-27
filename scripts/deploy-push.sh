#!/bin/bash
# Загрузка на гит с сервера: add → commit → push.
# Запускать на сервере при необходимости отправить локальные изменения.
# Использование: bash scripts/deploy-push.sh [сообщение коммита]
# Путь проекта: DEPLOY_ROOT (по умолчанию /opt/ALETHEIA)

set -e

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
GIT_BRANCH="${GIT_BRANCH:-main}"
COMMIT_MSG="${1:-Update from server $(date +%Y-%m-%d\ %H:%M)}"

cd "$DEPLOY_ROOT"
echo "=== Загрузка на Git: $DEPLOY_ROOT (ветка: $GIT_BRANCH) ==="

if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "Изменения:"
  git status -s
  echo ""
  git add -A
  git commit -m "$COMMIT_MSG"
  echo ""
  echo "Push в origin $GIT_BRANCH..."
  git push origin "$GIT_BRANCH"
  echo ""
  echo "=== Готово. Изменения отправлены в репозиторий. ==="
else
  echo ""
  echo "Нет изменений для коммита."
  echo "Использование: bash scripts/deploy-push.sh \"Сообщение коммита\""
fi
