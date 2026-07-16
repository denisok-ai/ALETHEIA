/**
 * llms.txt — карта сайта для ИИ-ассистентов и ИИ-поисковиков (спецификация llmstxt.org).
 * Генерируется динамически: тарифы и цены подтягиваются из БД, ссылки всегда актуальны.
 * Полная версия с описаниями — /llms-full.txt.
 */
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublicProducts } from '@/lib/shop/public-products';
import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const products = await getPublicProducts();

  const productLines = products.map((p) => {
    const price = p.price <= 0 ? 'бесплатно' : `${p.price.toLocaleString('ru-RU')} ₽`;
    return `- [${p.name}](${base}/services/${p.slug}): ${p.cardDescription.slice(0, 200)} Цена: ${price}.`;
  });

  const blogLines = blogPostsMeta.map(
    (p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.description}`
  );

  const text = `# AVATERRA (АВАТЕРРА)

> Онлайн-школа мышечного тестирования и кинезиологии Татьяны Стрельцовой. Обучение методу, который помогает находить причину проблемы через обратную связь тела за 30 секунд. Более 22 лет практики, 15 000+ консультаций. Сайт: ${base}

## Курсы и продукты
- [Курс «Навыки мышечного тестирования и работа с подсознанием»](${base}/course/navyki-myshechnogo-testirovaniya): основной курс школы — программа, форматы, отзывы
- [Курс «Пробуждение»](${base}/course/probuzhdenie): 3-недельная программа; группа 22 000 ₽, индивидуально 44 000 ₽
- [Каталог тарифов и услуг](${base}/services): актуальные цены и состав всех тарифов
${productLines.join('\n')}

## О школе
- [О Татьяне Стрельцовой](${base}/about): основательница школы, опыт и методика
- [Вопросы и ответы](${base}/faq): частые вопросы о методе и обучении
- [Контакты](${base}/contacts): телефон, email, как связаться

## Статьи блога
${blogLines.join('\n')}

## Документы
- [Публичная оферта](${base}/oferta)
- [Политика обработки персональных данных](${base}/privacy)

## Технические ресурсы
- [Полное описание для ИИ](${base}/llms-full.txt)
- [Карта сайта](${base}/sitemap.xml)
- [RSS](${base}/feed.xml)

## Служебные зоны (не для индексации)
- /login, /register, /portal — личный кабинет
- /api/ — только для приложения
`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
