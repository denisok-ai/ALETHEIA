/**
 * E2E: редирект после логина по роли — сразу на дашборд (минуя /portal).
 */
import { test, expect } from '@playwright/test';

const PASSWORD = 'Test123!';

test.describe('Редирект после логина по роли', () => {
  // Сначала student/manager (прогрев), затем admin — первый запрос может быть медленным
  test('student → /portal/student/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('student4@test.local');
    await page.getByLabel(/пароль/i).fill(PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await expect(page).toHaveURL(/\/portal\/student\/dashboard/, { timeout: 15000 });
  });

  test('manager → /portal/manager/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('manager@test.local');
    await page.getByLabel(/пароль/i).fill(PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await expect(page).toHaveURL(/\/portal\/manager\/dashboard/, { timeout: 15000 });
  });

  test('admin → /portal/admin/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@test.local');
    await page.getByLabel(/пароль/i).fill(PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await expect(page).toHaveURL(/\/portal\/admin\/dashboard/, { timeout: 15000 });
  });
});
