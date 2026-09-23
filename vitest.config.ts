import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Юнит-тесты чистых модулей (без БД и сети). Запуск: `npm test`.
 * Тесты с БД живут отдельно (tests/db) и запускаются явно — см. план развития.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    env: {
      // Подпись ссылок оффера — HMAC от NEXTAUTH_SECRET; в тестах нужен любой стабильный.
      NEXTAUTH_SECRET: 'test-secret-for-unit-tests',
      TELEGRAM_DISABLE_OUTBOUND: '1',
    },
  },
});
