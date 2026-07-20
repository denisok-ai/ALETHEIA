import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl, siteUrlHostForRobots } from '@/lib/site-url';

/**
 * Генерирует robots.txt. Разрешена индексация публичных страниц.
 * Базовый URL из БД (Портал → Настройки). Настройки вынесены в админку.
 *
 * force-dynamic ОБЯЗАТЕЛЕН. Без него Next запекает robots.txt на этапе сборки —
 * а сборка идёт на машине разработчика, где в локальной базе site_url равен
 * http://localhost:3000. Именно это и произошло: на прод уехал robots.txt со
 * строкой `Sitemap: http://localhost:3000/sitemap.xml`, и поисковики не могли
 * найти карту сайта. По логам за две недели Google не запросил её НИ РАЗУ.
 * У app/sitemap.ts эта пометка была, у robots.ts — нет.
 */
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSystemSettings();
  const baseUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  const disallow = ['/portal', '/portal/', '/api/', '/auth/'];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      // ИИ-поисковики и ассистенты: явно разрешаем публичный контент,
      // чтобы сайт цитировался в ответах (ChatGPT, Claude, Perplexity, Яндекс Нейро и др.)
      ...[
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
      ].map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    // Директива Host отменена Яндексом в 2018 году — главное зеркало
    // определяется редиректом и canonical, а не этой строкой.
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
