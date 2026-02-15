#!/bin/bash
# Выложить проект на GitHub. Запускать в терминале WSL (не в PowerShell).
# Использование: bash scripts/push-to-github.sh

set -e
cd "$(dirname "$0")/.."

echo "Текущая папка: $(pwd)"

if [ ! -d .git ]; then
  echo "Инициализация git..."
  git init
  git add .
  git commit -m "Initial commit: ALETHEIA landing"
  git branch -M main
else
  echo "Репозиторий уже есть. Добавляю изменения..."
  git add .
  git status
  if git diff --cached --quiet; then
    echo "Нет изменений для коммита."
  else
    git commit -m "Update: ALETHEIA landing"
  fi
fi

if ! git remote get-url origin 2>/dev/null; then
  echo "Добавляю remote origin..."
  git remote add origin https://github.com/denisok-ai/ALETHEIA.git
fi

echo "Пуш в GitHub (main)..."
git push -u origin main

echo "Готово. Репозиторий: https://github.com/denisok-ai/ALETHEIA"
