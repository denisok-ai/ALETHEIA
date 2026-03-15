/**
 * E2E: гость — публичные страницы, модалка покупки, FAQ, формы, защита портала.
 */
import { test, expect } from '@playwright/test';

test.describe('Главная страница', () => {
  test('загружается с заголовком и навигацией', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page).toHaveTitle(/AVATERRA|avaterra/i);
    // Фактические ссылки: Почему мы, Форматы, О мастере, Отзывы, Тарифы, FAQ
    await expect(page.getByRole('link', { name: /тарифы/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /faq/i })).toBeVisible();
    // Секция контактов присутствует
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('секции About, Pricing, FAQ, Contact присутствуют', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
    await expect(page.locator('#contact')).toBeVisible();
  });
});

test.describe('Модалка покупки', () => {
  test('кнопка Купить открывает модалку с полями', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800); // дать время на анимацию useInView
    const buyBtn = page.locator('#pricing').getByRole('button', { name: 'Купить' }).first();
    await expect(buyBtn).toBeVisible({ timeout: 10000 });
    await buyBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByLabel(/email/i)).toBeVisible();
    await expect(dialog.getByLabel(/имя/i)).toBeVisible();
    await expect(dialog.getByLabel(/телефон/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /перейти к оплате|оформить/i })).toBeVisible();
  });

  test('валидация: пустая форма — кнопка не ведёт на оплату', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const buyBtn = page.locator('#pricing').getByRole('button', { name: 'Купить' }).first();
    await expect(buyBtn).toBeVisible({ timeout: 10000 });
    await buyBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    const payBtn = page.getByRole('button', { name: /перейти к оплате/i });
    await payBtn.click();
    // HTML5 validation или клиентская — остаёмся в модалке, URL не меняется
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).not.toHaveURL(/paykeeper|payment/);
  });
});

test.describe('FAQ', () => {
  test('аккордеон раскрывает вопрос', async ({ page }) => {
    await page.goto('/');
    await page.locator('#faq').scrollIntoViewIfNeeded();
    const firstQuestion = page.getByRole('button', { name: /что такое мышечное тестирование/i });
    await firstQuestion.click();
    await expect(page.getByText(/метод кинезиологии/i)).toBeVisible();
  });
});

test.describe('Форма заявки', () => {
  test('форма видна с полями и кнопкой отправить', async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /отправить заявку/i })).toBeVisible();
    await expect(page.getByLabel(/имя/i).first()).toBeVisible();
    await expect(page.getByLabel(/телефон/i)).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test('валидация: пустая форма не отправляется (HTML5 required)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const submitBtn = page.getByRole('button', { name: /отправить заявку/i });
    await submitBtn.click();
    // HTML5 validation блокирует submit — остаёмся на странице, нет toast успеха
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/заявка отправлена|спасибо/i)).not.toBeVisible();
  });
});

test.describe('Регистрация', () => {
  test('/register загружается, ссылка на логин', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /регистрац|создайте/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /войти|есть аккаунт/i })).toBeVisible();
  });
});

test.describe('Страницы оферта и политика', () => {
  test('/oferta загружается', async ({ page }) => {
    await page.goto('/oferta');
    await expect(page.getByRole('heading', { name: /публичная оферта|оферта/i })).toBeVisible();
  });

  test('/privacy загружается', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /политика|конфиденциальност/i })).toBeVisible();
  });
});

test.describe('Новости', () => {
  test('/news/[id] — карточка публикации по ID из API', async ({ page, request }) => {
    const res = await request.get('/api/publications?limit=5');
    const data = res.ok ? await res.json().catch(() => null) : null;
    const items = data?.publications ?? data ?? [];
    const first = Array.isArray(items) ? items[0] : null;
    const id = first?.id ?? first?.slug;
    if (!id) {
      test.skip();
      return;
    }
    await page.goto(`/news/${id}`);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Валидация логина', () => {
  test('неверный пароль — сообщение об ошибке', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@test.local');
    await page.getByLabel(/пароль/i).fill('wrongpassword');
    await page.getByRole('button', { name: /войти/i }).click();
    // Текст: «Неверный email или пароль» или «Ошибка входа»
    await expect(page.getByText(/неверный email|ошибка входа/i)).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Защита портала', () => {
  test('переход на /portal/admin/dashboard без входа — редирект на /login', async ({ page }) => {
    await page.goto('/portal/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
