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
import { saveSeoTopics } from '@/lib/seo/topics';

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
  const params = new URL(request.url).searchParams;
  const dryRun = params.get('dry') === '1';
  // ?dry=1&store=1 — сохранить темы для облачного SEO-агента без отправки в Telegram.
  const store = !dryRun || params.get('store') === '1';

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

  // Data-driven темы: запросы, по которым нас уже показывают, но не кликают, —
  // готовые темы для следующих статей/терминов. «Новые» — чего не было неделю назад.
  const PREV_KEY = 'seo_digest_prev_queries';
  const prevRow = await prisma.systemSetting.findUnique({ where: { key: PREV_KEY } });
  let prevQueries: string[] = [];
  try {
    prevQueries = prevRow?.value ? (JSON.parse(prevRow.value) as string[]) : [];
  } catch {
    prevQueries = [];
  }
  const prevSet = new Set(prevQueries);
  const currentQueries = digest.topQueries.map((q) => q.query);
  const newQueries = currentQueries.filter((q) => !prevSet.has(q)).slice(0, 8);
  const topicIdeas = digest.topQueries.filter((q) => q.shows >= 2 && q.clicks === 0).slice(0, 6);
  if (!dryRun) {
    await prisma.systemSetting.upsert({
      where: { key: PREV_KEY },
      create: { key: PREV_KEY, value: JSON.stringify(currentQueries), category: 'seo' },
      update: { value: JSON.stringify(currentQueries) },
    });
  }

  if (store) await saveSeoTopics({ topicIdeas, newQueries, topQueries: digest.topQueries });

  const top8 = digest.topQueries.slice(0, 8);
  const lines = [
    `ИКС: ${digest.sqi} · страниц в поиске: ${digest.searchablePages}`,
    top8.length ? 'Топ запросов (показы/клики):' : 'Показов по запросам пока нет.',
    ...top8.map((q) => `· ${q.shows}/${q.clicks} — ${q.query.slice(0, 60)}`),
    ...(topicIdeas.length
      ? ['', '💡 Показывают, но не кликают — темы для статей/глоссария:', ...topicIdeas.map((q) => `· ${q.query.slice(0, 60)} (${q.shows} показов)`)]
      : []),
    ...(newQueries.length && prevQueries.length
      ? ['', '🆕 Новые запросы за неделю:', ...newQueries.map((q) => `· ${q.slice(0, 60)}`)]
      : []),
    ...(digest.problems.length
      ? ['', 'Диагностика Яндекса:', ...digest.problems.map((c) => `⚠ ${PROBLEM_LABEL[c] ?? c}`)]
      : ['', 'Диагностика Яндекса: проблем нет ✓']),
    ...(recrawled ? ['', `Свежих статей отправлено на переобход: ${recrawled}`] : []),
  ];

  if (!dryRun) {
    await notifyAdminsTelegram('seo_digest', lines);
    await markCronOk('yandex-webmaster-digest');
  }

  return NextResponse.json({ ok: true, digest, recrawled, topicIdeas, newQueries, dryRun });
}
