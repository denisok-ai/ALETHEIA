/**
 * Cron (каждые 10 минут): автопубликация постов соцсетей (lib/social/scheduler.ts).
 *
 * Расписание: /etc/cron.d/aletheia-http-cron → scripts/cron-http-call.sh social-publish
 * (запись — в scripts/install-aletheia-http-cron.sh, он перезаписывает файл целиком).
 *
 * Heartbeat пишем только если проход отработал без исключения: пауза и пустая очередь
 * — это успешный запуск.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { tick } from '@/lib/social/scheduler';

export const dynamic = 'force-dynamic';
// Загрузка ролика до 50 МБ через прокси может занять несколько минут.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const report = await tick(new Date());
  await markCronOk('social-publish');
  return NextResponse.json({ ok: true, ...report });
}
