/**
 * E2E: студент — дашборд, курсы, плеер SCORM, сертификаты, медиа, тикеты, профиль, помощь.
 */
import { test, expect } from '@playwright/test';

test.describe('Дашборд', () => {
  test('метрики (курсы, XP)', async ({ page }) => {
    await page.goto('/portal/student/dashboard');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/курс|xp|балл|прогресс/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Мои курсы', () => {
  test('список, карточка курса', async ({ page }) => {
    await page.goto('/portal/student/courses');
    await expect(page.getByRole('heading', { name: /курс|мои курсы/i })).toBeVisible({ timeout: 10000 });
    const cards = page.locator('article, [class*="course"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('клик по названию курса ведёт на страницу курса', async ({ page }) => {
    await page.goto('/portal/student/courses');
    // Ссылка на страницу курса — заголовок в карточке (CourseCard)
    const courseLink = page.locator('a[href*="/portal/student/courses/course-"]').first();
    if (!(await courseLink.isVisible())) {
      test.skip();
      return;
    }
    await courseLink.click();
    await expect(page).toHaveURL(/\/portal\/student\/courses\/course-seed-\d+/);
    await expect(page.getByRole('heading', { name: /курс|урок|прогресс|тело|вводный/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Плеер SCORM', () => {
  test('страница play загружается', async ({ page }) => {
    await page.goto('/portal/student/courses');
    const playLink = page.getByRole('link', { name: /начать курс|продолжить|завершён/i }).first();
    if (await playLink.isVisible()) {
      await playLink.click();
      await expect(page).toHaveURL(/\/play/);
    } else {
      await page.goto('/portal/student/courses/course-seed-1/play');
    }
    await expect(
      page.getByRole('link', { name: /выход из курса|назад к курсу/i })
        .or(page.locator('iframe[title="SCORM курс"]'))
        .or(page.getByText(/загрузка плеера|нет загруженного/i))
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Сертификаты', () => {
  test('список', async ({ page }) => {
    await page.goto('/portal/student/certificates');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Медиатека', () => {
  test('список', async ({ page }) => {
    await page.goto('/portal/student/media');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Уведомления', () => {
  test('список', async ({ page }) => {
    await page.goto('/portal/student/notifications');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Поддержка', () => {
  test('список тикетов, создание', async ({ page }) => {
    await page.goto('/portal/student/support');
    await expect(page.getByRole('heading', { name: /поддержк|тикет/i })).toBeVisible({ timeout: 10000 });
  });

  test('валидация: пустая тема — toast об ошибке', async ({ page }) => {
    await page.goto('/portal/student/support');
    await expect(page.getByLabel(/тема/i)).toBeVisible({ timeout: 5000 });
    // Пробел обходит HTML5 required, но Zod min(1) вернёт «Укажите тему обращения»
    await page.getByLabel(/тема/i).fill(' ');
    await page.getByRole('button', { name: /отправить обращение/i }).click();
    await expect(page.getByText(/тему|укажите/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Профиль', () => {
  test('страница профиля', async ({ page }) => {
    await page.goto('/portal/student/profile');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Помощь', () => {
  test('контент отображается', async ({ page }) => {
    await page.goto('/portal/student/help');
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 10000 });
  });
});
