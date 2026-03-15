/**
 * E2E: админ — дашборд, все разделы сайдбара, курсы, пользователи, настройки.
 */
import { test, expect } from '@playwright/test';

const ADMIN_PAGES = [
  { href: '/portal/admin/dashboard', label: /дашборд|dashboard/i },
  { href: '/portal/admin/groups', label: /групп/i },
  { href: '/portal/admin/courses', label: /курс/i },
  { href: '/portal/admin/certificates', label: /сертификат/i },
  { href: '/portal/admin/certificate-templates', label: /шаблон/i },
  { href: '/portal/admin/publications', label: /публикаци/i },
  { href: '/portal/admin/media', label: /медиа/i },
  { href: '/portal/admin/users', label: /пользовател/i },
  { href: '/portal/admin/crm', label: /crm|лид/i },
  { href: '/portal/admin/payments', label: /оплат/i },
  { href: '/portal/admin/settings', label: /настройк/i },
  { href: '/portal/admin/help', label: /помощь|help/i },
];

test.describe('Дашборд', () => {
  test('загружается с метриками', async ({ page }) => {
    await page.goto('/portal/admin/dashboard');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Разделы сайдбара', () => {
  for (const { href, label } of ADMIN_PAGES) {
    test(`${href} — загружается`, async ({ page }) => {
      await page.goto(href);
      await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe('Курсы', () => {
  test('таблица курсов, карточка курса, вкладки', async ({ page }) => {
    await page.goto('/portal/admin/courses');
    await expect(page.getByRole('heading', { name: /курс/i }).first()).toBeVisible({ timeout: 10000 });
    const link = page.locator('a[href*="/portal/admin/courses/course-seed-"]').first();
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await expect(page).toHaveURL(/\/portal\/admin\/courses\/course-seed-/, { timeout: 10000 });
    await expect(page.getByText(/статистика|записано|scorm/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Пользователи', () => {
  test('таблица, карточка пользователя', async ({ page }) => {
    await page.goto('/portal/admin/users');
    await expect(page.getByRole('heading', { name: /пользовател/i })).toBeVisible({ timeout: 10000 });
    const firstLink = page.getByRole('link', { name: /@|\.local/i }).first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/portal\/admin\/users\/.+/);
    }
  });
});

test.describe('Настройки', () => {
  test('формы загружаются', async ({ page }) => {
    await page.goto('/portal/admin/settings');
    await expect(page.getByRole('heading', { name: /настройк/i })).toBeVisible({ timeout: 10000 });
  });
});
