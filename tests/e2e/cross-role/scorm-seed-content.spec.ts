/**
 * E2E: SCORM-плеер с контентом из seed (без загрузки ZIP).
 * course-seed-1 и course-seed-2 получают минимальный HTML из prisma/seed.ts.
 */
import { test, expect } from '../fixtures';

const PASSWORD = 'Test123!';
const COURSE_ID = 'course-seed-1';

test('студент открывает плеер с seed-контентом (без загрузки SCORM)', async ({ page, loginAs, request }) => {
  // Записать студента на курс (если ещё не записан)
  await loginAs('admin@test.local', PASSWORD);
  const enrollRes = await page.request.post(
    `/api/portal/admin/courses/${COURSE_ID}/enrollments/bulk`,
    { data: { emails: ['student4@test.local'] } }
  );
  expect(enrollRes.ok()).toBeTruthy();

  // Студент открывает курсы и плеер
  await loginAs('student4@test.local', PASSWORD);
  await page.goto('/portal/student/courses');
  const playLink = page.getByRole('link', { name: /начать курс|продолжить|завершён/i }).first();
  if (await playLink.isVisible()) {
    await playLink.click();
  } else {
    await page.goto(`/portal/student/courses/${COURSE_ID}/play`);
  }
  await expect(page).toHaveURL(/\/play/);
  // Плеер показывает контент (iframe или навигацию) — не «нет загруженного»
  await expect(
    page.getByRole('link', { name: /выход из курса|назад к курсу/i })
      .or(page.locator('iframe[title="SCORM курс"]'))
      .or(page.getByText(/урок 1|введение|тестовый курс/i))
  ).toBeVisible({ timeout: 15000 });
});
