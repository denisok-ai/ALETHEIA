/**
 * E2E: менеджер — дашборд, тикеты, пользователи, верификация, помощь.
 */
import { test, expect } from '@playwright/test';

test.describe('Дашборд', () => {
  test('метрики', async ({ page }) => {
    await page.goto('/portal/manager/dashboard');
    await expect(page.getByRole('heading', { name: /дашборд/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/тикет|верификаци/i).first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole('link', { name: /Перейти к списку тикетов/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Перейти к верификациям/i })
    ).toBeVisible();
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
      await expect(page.getByText(/ID тикета:/)).toBeVisible({ timeout: 5000 });
    }
  });

  test('выгрузка в Excel', async ({ page }) => {
    await page.goto('/portal/manager/tickets');
    await expect(page.getByRole('heading', { name: /тикет/i }).first()).toBeVisible({ timeout: 10000 });
    const excelBtn = page.getByRole('button', { name: /Выгрузить в Excel/i });
    await expect(excelBtn).toBeVisible({ timeout: 15000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await excelBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^tickets-\d{4}-\d{2}-\d{2}\.xlsx$/);
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

  test('выгрузка в Excel', async ({ page }) => {
    await page.goto('/portal/manager/verifications');
    await expect(page.getByRole('heading', { name: /верификац/i })).toBeVisible({ timeout: 10000 });
    const excelBtn = page.getByRole('button', { name: /Выгрузить в Excel/i });
    await expect(excelBtn).toBeVisible();
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await excelBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^verifications-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  test('фильтры с подписями для доступности', async ({ page }) => {
    await page.goto('/portal/manager/verifications');
    await expect(page.getByRole('heading', { name: /верификац/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('combobox', { name: /статус заявки на верификацию/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /тип заявки: видео или текст/i })).toBeVisible();
  });
});

test.describe('Помощь', () => {
  test('контент и термин «История заряда»', async ({ page }) => {
    await page.goto('/portal/manager/help');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /помощь/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'История заряда' }).first()).toBeVisible();
  });
});

test.describe('ЛК студента (просмотр под менеджером)', () => {
  test('баннер «режим просмотра как слушатель»', async ({ page }) => {
    await page.goto('/portal/student/dashboard');
    const staffPreviewBanner = page.getByRole('status', { name: /режим просмотра как слушатель/i });
    await expect(staffPreviewBanner).toContainText(/менеджера или администратора/i, { timeout: 10000 });
  });
});
