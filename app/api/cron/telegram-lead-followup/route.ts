/**
 * Cron: автодогоны лидов Telegram-бота (два касания, без участия менеджера).
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 *
 * ?dry=1 — только показать кандидатов (ничего не шлёт, heartbeat не пишет).
 * Логика окон и идемпотентность — в lib/telegram-lead-followup.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { runTelegramLeadFollowup } from '@/lib/telegram-lead-followup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const result = await runTelegramLeadFollowup({ dryRun });

  if (!dryRun) await markCronOk('telegram-lead-followup');

  return NextResponse.json(result);
}
