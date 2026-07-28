/**
 * Cron: напоминание «записались на курс, но так и не открыли».
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 *
 * ?dry=1 — только показать кандидатов (ничего не шлёт, heartbeat не пишет).
 * Идемпотентность и границы окна — в lib/enrollment-nudge.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { nudgeInactiveEnrollees } from '@/lib/enrollment-nudge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const result = await nudgeInactiveEnrollees({ dryRun });

  // Heartbeat пишем только за реальный прогон, а не за ручной dry-run-пробник.
  if (!dryRun) await markCronOk('nudge-inactive-enrollees');

  return NextResponse.json(result);
}
