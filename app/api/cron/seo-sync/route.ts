/**
 * Cron (каждую ночь, 03:30 МСК): синк SEO-метрик GSC, Метрики и Вебмастера в SeoMetric (lib/seo/sync.ts).
 *
 * Расписание: /etc/cron.d/aletheia-http-cron → scripts/cron-http-call.sh seo-sync
 * (запись — в scripts/install-aletheia-http-cron.sh, он перезаписывает файл целиком).
 *
 * ?dry=1 — коннекторы вызываются, но ни метрики, ни журнал, ни heartbeat не пишем.
 * ?days=N (1..480) — ручной дозабор: окно N дней, заканчивающееся на штатной дате конца.
 *
 * Heartbeat пишем, если проход отработал без исключения: сбой отдельного источника
 * — это его state в отчёте, а не падение задачи.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { runSeoSync } from '@/lib/seo/sync';

export const dynamic = 'force-dynamic';
// Три источника подряд с пагинацией и квотами API — с запасом до минут.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const params = new URL(request.url).searchParams;
  const dryRun = params.get('dry') === '1';

  let days: number | undefined;
  const daysRaw = params.get('days');
  if (daysRaw !== null) {
    const n = Number(daysRaw);
    if (!Number.isInteger(n) || n < 1 || n > 480) {
      return NextResponse.json({ ok: false, error: 'days: целое число от 1 до 480' }, { status: 400 });
    }
    days = n;
  }

  const report = await runSeoSync({ now: new Date(), days, dryRun });
  if (!dryRun) await markCronOk('seo-sync');
  return NextResponse.json({ ok: true, dryRun, days: days ?? null, ...report });
}
