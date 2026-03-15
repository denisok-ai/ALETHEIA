/**
 * Общие fixtures для E2E-тестов.
 */
import { test as base } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

export const test = base.extend<{
  loginAs: (email: string, password: string) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const loginAs = async (email: string, password: string) => {
      // Очистка cookies перед сменой пользователя
      await page.context().clearCookies();
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/пароль/i).fill(password);
      await page.getByRole('button', { name: /войти/i }).click();
      await page.waitForURL(/\/portal/, { timeout: 25000 });
    };
    await use(loginAs);
  },
});

export { expect } from '@playwright/test';
