/**
 * robots.txt.
 *
 * Написан вручную, а не через MetadataRoute.Robots: типизированный API Next не
 * умеет `Clean-param` — директиву, которую понимает только Яндекс и которая
 * заметно влияет на индексацию (см. ниже).
 *
 * force-dynamic ОБЯЗАТЕЛЕН. Без него Next запекает robots.txt на этапе сборки —
 * а сборка идёт на машине разработчика, где в локальной базе site_url равен
 * http://localhost:3000. Именно это и произошло: на прод уехал robots.txt со
 * строкой `Sitemap: http://localhost:3000/sitemap.xml`, и поисковики не могли
 * найти карту сайта. По логам за две недели Google не запросил её НИ РАЗУ.
 */
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const DISALLOW = ['/portal', '/portal/', '/api/', '/auth/'];

/**
 * Исключения из Disallow. `/api/og/` — OG-карточки статей (og:image указывает
 * на /api/og/blog/<slug>): без явного Allow запрет /api/ не давал роботам
 * забирать картинки статей — терялись превью в поисковой выдаче и Дзене.
 * Более длинное правило Allow побеждает Disallow и у Google, и у Яндекса.
 */
const ALLOW_EXCEPTIONS = ['/api/og/'];

/**
 * ИИ-поисковики и ассистенты: явно разрешаем публичный контент, чтобы школа
 * попадала в ответы (ChatGPT, Claude, Perplexity, Яндекс Нейро и другие).
 */
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'meta-externalagent',
  'YandexAdditional',
];

/**
 * Метки, не меняющие содержимое страницы.
 *
 * Ссылку на статью из рассылки или рекламы Яндекс видит как
 * `/blog/telo-znaet-otvet?utm_source=telegram` и считает отдельной страницей —
 * получается дубль основного адреса, между которыми размывается вес. Clean-param
 * говорит роботу склеить их с чистым URL.
 *
 * `page` сюда НЕ входит: постраничная навигация блога — разные страницы с
 * разными статьями, и склеивать их нельзя, иначе из индекса выпадет всё, что
 * дальше первой девятки.
 */
const CLEAN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'yclid',
  'ymclid',
  'gclid',
  'fbclid',
  'from',
  '_openstat',
];

function block(userAgent: string): string {
  return [
    `User-Agent: ${userAgent}`,
    'Allow: /',
    ...ALLOW_EXCEPTIONS.map((p) => `Allow: ${p}`),
    ...DISALLOW.map((p) => `Disallow: ${p}`),
  ].join('\n');
}

export async function GET() {
  const settings = await getSystemSettings();
  const baseUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');

  const body = [
    `# Карта для ИИ-ассистентов (llmstxt.org): ${baseUrl}/llms.txt`,
    `# Полное описание школы и курсов: ${baseUrl}/llms-full.txt`,
    block('*'),
    ...AI_AGENTS.map(block),
    // Отдельный блок для Яндекса: Clean-param он читает только в своей секции.
    [block('Yandex'), `Clean-param: ${CLEAN_PARAMS.join('&')}`].join('\n'),
    // Директива Host отменена Яндексом в 2018 году — главное зеркало
    // определяется редиректом и canonical, а не этой строкой.
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join('\n\n');

  return new Response(`${body}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
