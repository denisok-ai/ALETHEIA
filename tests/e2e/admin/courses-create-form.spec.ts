/**
 * E2E: админ — форма «Новый курс»: поле SCORM только для формата SCORM.
 */
import { test, expect } from '@playwright/test';

test.describe('Форма создания курса', () => {
  test('по умолчанию есть ZIP SCORM; при «мероприятии» поле скрыто', async ({ page }) => {
    await page.goto('/portal/admin/courses');
    await page.getByRole('button', { name: /создать курс/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Новый курс' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#newScorm')).toBeVisible();
    await page.selectOption('#new-format', 'live_event');
    await expect(page.locator('#newScorm')).toHaveCount(0);
    await expect(page.getByLabel(/площадка или «онлайн»/i)).toBeVisible();
    await page.selectOption('#new-format', 'scorm');
    await expect(page.locator('#newScorm')).toBeVisible();
  });
});
