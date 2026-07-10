/**
 * Cron: запуск запланированных рассылок (scheduleMode=scheduled, status=planned, scheduledAt <= now).
 * Вызывать по расписанию (например Vercel Cron) или вручную с заголовком Authorization: Bearer <CRON_SECRET>.
 * Секрет: из БД (Портал → Настройки → Переменные окружения). Настройки вынесены в админку.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runMailingSend } from '@/lib/mailing-send';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const now = new Date();
  const mailings = await prisma.mailing.findMany({
    where: {
      status: 'planned',
      scheduleMode: 'scheduled',
      scheduledAt: { lte: now },
    },
    select: { id: true, internalTitle: true },
  });

  const results: { id: string; title: string; sent?: number; failed?: number }[] = [];
  for (const m of mailings) {
    const result = await runMailingSend(m.id, 'cron');
    results.push({
      id: m.id,
      title: m.internalTitle,
      ...(result ? { sent: result.sent, failed: result.failed } : {}),
    });
  }

  return NextResponse.json({ processed: results.length, results });
}
