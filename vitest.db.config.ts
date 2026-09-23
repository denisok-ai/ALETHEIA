import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Тесты с БД: изолированная sqlite создаётся в globalSetup через
 * `prisma migrate deploy` (те же миграции, что на проде). Запуск: `npm run test:db`.
 * Отдельно от `npm test`, чтобы юнит-прогон оставался мгновенным.
 */
const DB_PATH = path.resolve(__dirname, '.vitest-db', 'test.db');

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/db/global-setup.ts'],
    // Тесты делят одну БД — последовательно, без гонок.
    fileParallelism: false,
    env: {
      DATABASE_URL: `file:${DB_PATH}`,
      NEXTAUTH_SECRET: 'test-secret-for-db-tests',
      // Ни одно сообщение не должно уйти в Telegram из тестов.
      TELEGRAM_DISABLE_OUTBOUND: '1',
    },
    testTimeout: 30_000,
  },
});
