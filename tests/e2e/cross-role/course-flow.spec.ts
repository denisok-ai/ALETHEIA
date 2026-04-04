/**
 * E2E: сквозной сценарий — админ загружает SCORM, студент видит курс и открывает плеер.
 */
import { test, expect } from '../fixtures';
import path from 'path';
import { existsSync } from 'fs';

const PASSWORD = 'Test123!';
const SCORM_ZIP = path.join(process.cwd(), 'docs', 'Agile (7).zip');
const COURSE_ID = 'course-seed-2';

test('админ загружает SCORM → студент видит курс и открывает плеер', async ({ page, loginAs }) => {
  test.skip(!existsSync(SCORM_ZIP), `Нужен файл docs/Agile (7).zip для загрузки SCORM`);

  await loginAs('admin@test.local', PASSWORD);
  await page.goto(`/portal/admin/courses/${COURSE_ID}`);
  await expect(page.getByRole('heading', { name: /курс|тело|вводный|поток/i }).first()).toBeVisible({ timeout: 10000 });

  const fileInput = page.locator('input[type="file"][accept*=".zip"]').first();
  await expect(fileInput).toBeAttached({ timeout: 15000 });
  await fileInput.scrollIntoViewIfNeeded();
  await fileInput.setInputFiles(SCORM_ZIP);
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByText(/SCORM-пакет загружен|SCORM 1\.2|Просмотр SCORM/i).first()
  ).toBeVisible({ timeout: 20000 });

  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/student/courses');
  const playLink = page.getByRole('link', { name: /начать курс|продолжить|завершён/i }).first();
  await expect(playLink).toBeVisible({ timeout: 5000 });
  await playLink.click();
  await expect(page).toHaveURL(/\/play/);
  await expect(
    page
      .getByRole('link', { name: /выход из курса|назад к курсу/i })
      .or(page.locator('iframe[title="SCORM курс"]'))
      .first()
  ).toBeVisible({ timeout: 15000 });
});
