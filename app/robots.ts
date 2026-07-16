import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl, siteUrlHostForRobots } from '@/lib/site-url';

/**
 * Генерирует robots.txt. Разрешена индексация публичных страниц.
 * Базовый URL из БД (Портал → Настройки). Настройки вынесены в админку.
 */
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
    host: siteUrlHostForRobots(settings.site_url || 'https://avaterra.pro'),
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
