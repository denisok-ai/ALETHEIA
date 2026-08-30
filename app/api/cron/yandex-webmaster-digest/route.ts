/**
 * Cron (еженедельно): SEO-дайджест Яндекс.Вебмастера админам в Telegram.
 *
 * Показывает динамику того, ради чего идёт работа над внешними сигналами:
 * ИКС, страницы в поиске, живые проблемы диагностики, топ запросов с
 * показами/кликами. Плюс дострел переобхода: статьи, опубликованные за
 * последнюю неделю, отправляются в очередь Яндекса повторно (идемпотентно
 * с точки зрения индексации; квота 150/день это позволяет).
 *
 * ?dry=1 — собрать и вернуть JSON без отправки в Telegram и без heartbeat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { fetchWebmasterDigest, recrawlUrl } from '@/lib/seo/yandex-webmaster';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Человекочитаемые названия кодов диагностики (остальные показываем кодом). */
const PROBLEM_LABEL: Record<string, string> = {
  NO_METRIKA_COUNTER_CRAWL_ENABLED: 'обход по счётчику Метрики выключен',
  NOT_IN_SPRAV: 'сайт не добавлен в Яндекс.Бизнес',
  BIG_FAVICON_ABSENT: 'нет большой favicon 120×120',
};

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const digest = await fetchWebmasterDigest();
  if (!digest) {
    // Токен не настроен — тихо выходим (это опциональная интеграция).
    if (!dryRun) await markCronOk('yandex-webmaster-digest');
    return NextResponse.json({ ok: false, reason: 'no-token-or-api' });
  }

  // Дострел переобхода свежих статей (за 8 дней — с запасом к недельному крону).
  const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const fresh = await prisma.blogPost.findMany({
    where: { status: 'published', publishedAt: { gte: weekAgo } },
    select: { slug: true },
    take: 20,
  });
  let recrawled = 0;
  if (!dryRun) {
    for (const p of fresh) {
      if (await recrawlUrl(`${base}/blog/${p.slug}`)) recrawled += 1;
    }
  }

  const lines = [
    `ИКС: ${digest.sqi} · страниц в поиске: ${digest.searchablePages}`,
    digest.topQueries.length
      ? 'Топ запросов (показы/клики):'
      : 'Показов по запросам пока нет.',
    ...digest.topQueries.map((q) => `· ${q.shows}/${q.clicks} — ${q.query.slice(0, 60)}`),
    ...(digest.problems.length
      ? ['', 'Диагностика Яндекса:', ...digest.problems.map((c) => `⚠ ${PROBLEM_LABEL[c] ?? c}`)]
      : ['', 'Диагностика Яндекса: проблем нет ✓']),
    ...(recrawled ? ['', `Свежих статей отправлено на переобход: ${recrawled}`] : []),
  ];

  if (!dryRun) {
    await notifyAdminsTelegram('seo_digest', lines);
    await markCronOk('yandex-webmaster-digest');
  }

  return NextResponse.json({ ok: true, digest, recrawled, dryRun });
}
