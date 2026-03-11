#!/bin/bash
# Локальная отладка: Supabase (PostgreSQL) + Next.js
# Требует: Docker, npx supabase

set -e
cd "$(dirname "$0")/.."

echo "=== AVATERRA: локальная БД (PostgreSQL) ==="

# Запуск Supabase (если не запущен)
if ! npx supabase status 2>/dev/null | grep -q "API URL"; then
  echo "Запуск Supabase..."
  npx supabase start
fi

# Вывод URL и ключей для .env.local
echo ""
echo "Добавьте в .env.local (или скопируйте из вывода supabase status):"
npx supabase status 2>/dev/null | grep -E "API URL|anon key|service_role" || true

echo ""
echo "Запуск Next.js dev..."
npm run dev
