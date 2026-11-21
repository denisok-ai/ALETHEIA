#!/usr/bin/env bash
# Prettier только для изменённых файлов: незакоммиченные правки + коммиты ветки,
# которых нет в origin/main. Весь код разом не форматируем (решение 21.11.2026,
# docs/Development-Standards.md) — стиль выравнивается по мере правок.
#
#   npm run format:changed          — отформатировать
#   npm run format:changed -- --check — только проверить (код выхода 1, если есть что править)
set -euo pipefail
cd "$(dirname "$0")/.."

mode="--write"
[[ "${1:-}" == "--check" ]] && mode="--check"

base="$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)"
mapfile -t files < <(
  { git diff --name-only --diff-filter=ACMR "$base"; git diff --name-only --diff-filter=ACMR; git diff --name-only --cached --diff-filter=ACMR; git ls-files --others --exclude-standard; } \
    | sort -u \
    | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|css|yml|yaml)$' \
    | while read -r f; do [[ -f "$f" ]] && echo "$f"; done
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "format:changed — изменённых файлов нет"
  exit 0
fi

npx prettier "$mode" --ignore-unknown "${files[@]}"
