/**
 * E2E: админ — загрузка SCORM Agile через админку.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';

const SCORM_ZIP = path.join(process.cwd(), 'docs', 'Agile (7).zip');
const COURSE_ID = 'course-seed-2';

test.describe('Загрузка SCORM', () => {
  test('админ загружает Agile (7).zip в курс, видит SCORM 1.2', async ({ page }) => {
    test.skip(!existsSync(SCORM_ZIP), `Нужен файл docs/Agile (7).zip для загрузки SCORM`);

    await page.goto(`/portal/admin/courses/${COURSE_ID}`);
    await expect(page.getByRole('heading', { name: /курс|тело|вводный|поток/i }).first()).toBeVisible({ timeout: 10000 });

    // ScormVersionsBlock: accept=".zip,application/zip" — не только ".zip"
    const fileInput = page.locator('input[type="file"][accept*=".zip"]').first();
    await expect(fileInput).toBeAttached({ timeout: 15000 });
    await fileInput.scrollIntoViewIfNeeded();
    await fileInput.setInputFiles(SCORM_ZIP);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/SCORM-пакет загружен|SCORM 1\.2|Просмотр SCORM/i).first()
    ).toBeVisible({ timeout: 20000 });
  });
});
