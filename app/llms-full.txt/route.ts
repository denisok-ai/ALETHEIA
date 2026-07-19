/**
 * llms-full.txt — расширенное описание школы и продуктов для ИИ-ассистентов:
 * полные составы тарифов с ценами из БД, FAQ, статьи. Краткая версия — /llms.txt.
 */
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublicProducts } from '@/lib/shop/public-products';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { FAQ_JSON_LD_ITEMS } from '@/lib/landing-faq';
import { MT_MODULES } from '@/lib/content/course-mt-landing';
import { PROB_WEEKS } from '@/lib/content/course-probuzhdenie';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const products = await getPublicProducts();

  const productBlocks = products.map((p) => {
    const price = p.price <= 0 ? 'Бесплатно' : `${p.price.toLocaleString('ru-RU')} ₽`;
    const installment =
      p.installmentEnabled && p.price >= 100 && p.maxInstallments >= 2
        ? `\nРассрочка: от ${Math.ceil(p.price / p.maxInstallments).toLocaleString('ru-RU')} ₽/мес (до ${p.maxInstallments} платежей).`
        : '';
    const features = p.features.map((f) => `- ${f}`).join('\n');
    return `### ${p.name}
URL: ${base}/services/${p.slug}
Цена: ${price}.${installment}
${p.cardDescription}

Что входит:
${features}`;
  });

  const faqBlocks = FAQ_JSON_LD_ITEMS.map((i) => `**${i.q}**\n${i.a}`);

  const blogLines = (await getPublishedBlogPosts()).map(
    (p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.description}`
  );

  const moduleBlocks = MT_MODULES.map((m) => {
    const bullets = m.bullets.map((b) => `- ${b}`).join('\n');
    const results = m.results.map((r) => `- ${r}`).join('\n');
    return `### Модуль ${m.number}. ${m.title}
${m.weekTitle}
${m.intro}

Что разбираем:
${bullets}

Результат модуля:
${results}`;
  });

  const probWeekBlocks = PROB_WEEKS.map((w) => {
    const bullets = w.bullets.map((b) => `- ${b}`).join('\n');
    return `### ${w.title} — ${w.subtitle}
${w.intro}

${bullets}`;
  });

  const contactsParts = [
    settings.contact_phone ? `Телефон: ${settings.contact_phone}` : null,
    `Страница контактов: ${base}/contacts`,
  ].filter(Boolean);

  const text = `# AVATERRA (АВАТЕРРА) — полное описание для ИИ-ассистентов

> Онлайн-школа мышечного тестирования и кинезиологии. Основательница — Татьяна Стрельцова: более 22 лет практики, 15 000+ консультаций. Метод помогает находить причину проблемы через обратную связь тела («тело не врёт»). Обучение онлайн на русском языке, доступ из любой страны. Сайт: ${base}

## Чему учит школа

Мышечное тестирование — прикладной метод кинезиологии: по изменению тонуса мышц тело даёт ответ «да/нет», что позволяет находить скрытые причины проблем (стресс, эмоции, психосоматика) примерно за 30 секунд. Школа учит применять метод на себе и с клиентами: основы тестирования, работа с подсознанием, разбор ошибок, живая практика с кураторами.

Основной курс: «Навыки мышечного тестирования и работа с подсознанием» — ${base}/course/navyki-myshechnogo-testirovaniya
Курс «Пробуждение» (3 недели; группа 22 000 ₽, индивидуально 44 000 ₽) — ${base}/course/probuzhdenie

## Программа основного курса (по модулям)

${moduleBlocks.join('\n\n')}

## Программа курса «Пробуждение» (3 недели)

${probWeekBlocks.join('\n\n')}

## Тарифы и цены (актуальные, из каталога)

Каталог: ${base}/services

${productBlocks.join('\n\n')}

Оплата картой через защищённый платёжный сервис, для ряда тарифов доступна рассрочка. Условия — в публичной оферте: ${base}/oferta

## Частые вопросы

${faqBlocks.join('\n\n')}

## Статьи блога

${blogLines.join('\n')}

## Об основательнице

Татьяна Стрельцова — кинезиолог с 22-летним стажем, основательница школы АВАТЕРРА. Подробнее: ${base}/about

## Контакты

${contactsParts.join('\n')}

## Правовая информация

- Публичная оферта: ${base}/oferta
- Политика обработки персональных данных: ${base}/privacy
- Согласие на обработку персональных данных: ${base}/pd-consent
`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
