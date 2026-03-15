/**
 * Playwright E2E config — AVATERRA.
 * Порт 3001, проекты по ролям (guest, student, manager, admin).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // последовательный запуск для стабильности с SQLite
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // SQLite не любит параллельные запросы
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'guest',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /guest\/.*\.spec\.ts/,
      dependencies: [],
    },
    {
      name: 'student',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/student.json',
      },
      testMatch: /student\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'cross-role',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /cross-role\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'manager',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/manager.json',
      },
      testMatch: /manager\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
      },
      testMatch: /admin\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'PORT=3001 npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
