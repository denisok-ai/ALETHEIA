/**
 * E2E: гость — публичные страницы, модалка покупки, вопросы и ответы, формы, защита портала.
 */
import { test, expect } from '@playwright/test';

test.describe('Главная страница', () => {
  test('загружается с заголовком и навигацией', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page).toHaveTitle(/АВАТЕРРА|AVATERRA|avaterra|кинезиологии/i);
    await expect(page.getByRole('link', { name: /^Цены$/i })).toBeVisible({ timeout: 5000 });
    // Два одинаковых пункта в шапке и футере — привязываемся к основной навигации
    await expect(
      page.getByLabel('Основное меню').getByRole('link', { name: /Вопросы и ответы/ })
    ).toBeVisible();
    await expect(page.locator('#method')).toBeAttached();
    const faqExtended = page.locator('#faq-extended');
    await expect(faqExtended).toBeAttached();
    await faqExtended.scrollIntoViewIfNeeded();
    await expect(faqExtended).toBeVisible();
  });

  test('Hero: CTA — ссылки без вложенных button (валидная разметка)', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('#hero');
    const ctaLinks = hero.locator('a').filter({
      hasText: /Записаться на бесплатный пробный урок|Купить курс/i,
    });
    const count = await ctaLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      await expect(ctaLinks.nth(i).locator('button')).toHaveCount(0);
    }
  });

  test('Hero: ссылка «Купить курс» ведёт на оформление (внешнее или блок цен)', async ({ page }) => {
    await page.goto('/');
    const buyCourse = page.locator('#hero').getByRole('link', { name: /Купить курс/i });
    await expect(buyCourse).toBeVisible({ timeout: 5000 });
    const buyHref = await buyCourse.getAttribute('href');
    expect(buyHref).toBeTruthy();
    expect(buyHref).toMatch(/^(https?:\/\/|\/#)/);
    // При NEXT_PUBLIC_COURSE_CHECKOUT_URL=https://… — новая вкладка; по умолчанию /#pricing — без target
    if (buyHref?.startsWith('http://') || buyHref?.startsWith('https://')) {
      await expect(buyCourse).toHaveAttribute('target', '_blank');
      await expect(buyCourse).toHaveAttribute('rel', /noopener/);
    } else {
      const target = await buyCourse.getAttribute('target');
      expect(target === null || target === '').toBeTruthy();
    }
  });

  test('секции About, Pricing, вопросы и ответы, блок помощника присутствуют', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#pricing', '#faq', '#faq-extended'] as const) {
      const el = page.locator(id);
      await expect(el).toBeAttached();
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }
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

test.describe('Вопросы и ответы', () => {
  test('аккордеон раскрывает вопрос', async ({ page }) => {
    await page.goto('/');
    const faq = page.locator('#faq');
    await faq.scrollIntoViewIfNeeded();
    // Первый пункт в LandingFAQ открыт по умолчанию — клик по нему закрывает панель.
    // Проверяем раскрытие на втором пункте (изначально закрыт).
    const secondQuestion = faq.getByRole('button', { name: /кому подойдёт этот курс/i });
    await expect(secondQuestion).toBeVisible({ timeout: 10000 });
    await secondQuestion.click();
    await expect(
      faq.getByText(/тело и подсознание|саморазвития/i)
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Блок помощника (FAQ extended)', () => {
  test('заголовок и поле вопроса', async ({ page }) => {
    await page.goto('/');
    await page.locator('#faq-extended').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /вопросы и помощник по курсу/i })).toBeVisible();
    await expect(page.locator('#faq-extended').getByPlaceholder(/поиск по вопросам/i)).toBeVisible();
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
    await expect(page.getByRole('navigation', { name: /Разделы: оплата, доступ, возврат/i })).toBeVisible();
    await expect(page.locator('#oplata')).toBeVisible();
    await expect(page.locator('#dostup')).toBeVisible();
    await expect(page.locator('#vozvrat')).toBeVisible();
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
