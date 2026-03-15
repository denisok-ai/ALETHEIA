/**
 * E2E: менеджер — дашборд, тикеты, пользователи, верификация, помощь.
 */
import { test, expect } from '@playwright/test';

test.describe('Дашборд', () => {
  test('метрики', async ({ page }) => {
    await page.goto('/portal/manager/dashboard');
    await expect(page.getByRole('heading', { name: /дашборд/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/тикет|верификаци/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Тикеты', () => {
  test('список, переход в карточку', async ({ page }) => {
    await page.goto('/portal/manager/tickets');
    await expect(page.getByRole('heading', { name: /тикет/i }).first()).toBeVisible({ timeout: 10000 });
    const ticketLink = page.locator('a[href*="/portal/manager/tickets/"]').first();
    if (await ticketLink.isVisible()) {
      await ticketLink.click();
      await expect(page).toHaveURL(/\/portal\/manager\/tickets\/.+/);
    }
  });
});

test.describe('Пользователи', () => {
  test('поиск', async ({ page }) => {
    await page.goto('/portal/manager/users');
    await expect(page.getByRole('heading', { name: /пользовател/i })).toBeVisible({ timeout: 10000 });
    const searchInput = page.getByPlaceholder(/поиск|email|имя/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('student');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Верификация', () => {
  test('список', async ({ page }) => {
    await page.goto('/portal/manager/verifications');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Помощь', () => {
  test('контент', async ({ page }) => {
    await page.goto('/portal/manager/help');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});
