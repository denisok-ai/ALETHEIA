/**
 * E2E: сквозной сценарий — загрузка SCORM, прохождение студентом, сертификат, результаты в админке.
 */
import { test, expect } from '../fixtures';
import path from 'path';
import { existsSync } from 'fs';

const PASSWORD = 'Test123!';
const SCORM_ZIP = path.join(process.cwd(), 'docs', 'Agile (7).zip');
const COURSE_ID = 'course-seed-2';

test('админ загружает SCORM → студент проходит → сертификат → админ видит результаты', async ({
  page,
  loginAs,
  request,
}) => {
  test.skip(!existsSync(SCORM_ZIP), `Нужен файл docs/Agile (7).zip для загрузки SCORM`);

  // Фаза 1 — Админ: загрузка SCORM
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

  // Записать студента на курс (если ещё не записан)
  const enrollRes = await page.request.post(
    `/api/portal/admin/courses/${COURSE_ID}/enrollments/bulk`,
    { data: { emails: ['student4@test.local'] } }
  );
  expect(enrollRes.ok()).toBeTruthy();

  // Получить identifier урока из структуры (используем контекст страницы с admin cookies)
  const structRes = await page.request.get(
    `/api/portal/scorm/course-structure?courseId=${encodeURIComponent(COURSE_ID)}`
  );
  const structData = structRes.ok ? await structRes.json() : null;
  const lessonId = structData?.items?.[0]?.identifier ?? 'main';

  // Фаза 2 — Студент: имитация завершения курса через API
  await loginAs('student4@test.local', PASSWORD);
  const progressRes = await page.request.post('/api/portal/scorm/progress', {
    data: {
      courseId: COURSE_ID,
      lessonId,
      completionStatus: 'completed',
      score: 85,
      time_spent: 1800,
    },
  });
  expect(progressRes.ok()).toBeTruthy();

  // Фаза 3 — Студент: проверка сертификата
  await page.goto('/portal/student/certificates');
  await expect(page.getByText(/ALT-/).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('link', { name: /скачать|pdf/i }).first()).toBeVisible({ timeout: 5000 });

  // Фаза 4 — Админ: проверка результатов
  await loginAs('admin@test.local', PASSWORD);
  await page.goto(`/portal/admin/courses/${COURSE_ID}`);
  await page.getByRole('button', { name: /результат/i }).click();
  await expect(page.getByText(/завершен|100%|85|Студент 4/i).first()).toBeVisible({ timeout: 10000 });

  await page.goto('/portal/admin/certificates');
  await expect(page.getByText(/student4|Студент 4/i).first()).toBeVisible({ timeout: 5000 });
});
