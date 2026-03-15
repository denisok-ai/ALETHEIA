/**
 * Playwright auth setup — логин под admin, manager, student.
 * Сохраняет storageState в tests/.auth/*.json для проектов с зависимостью setup.
 */
import { test as setup } from '@playwright/test';

const PASSWORD = 'Test123!';

// Прогрев сервера — первый запрос после старта может быть медленным
setup('warm up server', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

// Порядок: student → manager → admin
const roles = [
  { name: 'student', email: 'student4@test.local', storageState: 'tests/.auth/student.json' },
  { name: 'manager', email: 'manager@test.local', storageState: 'tests/.auth/manager.json' },
  { name: 'admin', email: 'admin@test.local', storageState: 'tests/.auth/admin.json' },
] as const;

for (const { name, email, storageState } of roles) {
  setup(`authenticate as ${name}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/пароль/i).fill(PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/portal/, { timeout: 25000 });
    await page.context().storageState({ path: storageState });
  });
}
