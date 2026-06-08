#!/usr/bin/env bash
# Локально (WSL): освободить типичные порты dev/prod Next и остановить prisma studio.
set -u
echo "=== До остановки (порты проекта) ==="
ss -ltnp 2>/dev/null | grep -E ':3000|:3001|:4000|:3010|:5555' || echo "(ничего не слушает)"

PORTS=(3000 3001 4000 3010 5555)
for p in "${PORTS[@]}"; do
  if fuser "${p}/tcp" 2>/dev/null; then
    fuser -k "${p}/tcp" 2>/dev/null && echo "Порт $p: процессы завершены"
  fi
done

# Остатки next dev / next start (только пользовательские, не системные)
if command -v pkill >/dev/null; then
  pkill -u "$(id -un)" -f 'next dev' 2>/dev/null && echo "pkill next dev" || true
  pkill -u "$(id -un)" -f 'next start' 2>/dev/null && echo "pkill next start" || true
fi

echo ""
echo "=== После остановки ==="
ss -ltnp 2>/dev/null | grep -E ':3000|:3001|:4000|:3010|:5555' || echo "Порты 3000–3010,4000,5555 свободны (или не использовались)"
