/**
 * Cron (понедельник 09:15 МСК): недельный SEO-дайджест владельцу в Telegram (T2.3).
 *
 * Источники: SeoMetric (GSC, Метрика), журнал синков, оплаты и заявки с меткой ?ref=.
 * «Отправлено» — только когда Telegram принял сообщение (sent > 0); иначе heartbeat не пишем.
 *
 * ?dry=1 — собрать и вернуть JSON и текст без отправки в Telegram и без heartbeat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { buildSeoWeeklyDigest } from '@/lib/seo/weekly-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const { lines, data } = await buildSeoWeeklyDigest(new Date());

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, lines, data });
  }

  const result = await notifyAdminsTelegram('seo_weekly_digest', lines);
  const delivered = result.sent > 0;
  if (delivered) await markCronOk('seo-weekly-digest');

  return NextResponse.json({
    ok: delivered,
    dryRun: false,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    lines,
  });
}
