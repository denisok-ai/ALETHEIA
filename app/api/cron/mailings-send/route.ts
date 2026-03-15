/**
 * Cron: запуск запланированных рассылок (scheduleMode=scheduled, status=planned, scheduledAt <= now).
 * Вызывать по расписанию (например Vercel Cron) или вручную с заголовком Authorization: Bearer <CRON_SECRET>.
 * Секрет: из БД (настройки → Переменные окружения) или process.env.CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getEnvOverrides } from '@/lib/settings';
import { runMailingSend } from '@/lib/mailing-send';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const overrides = await getEnvOverrides();
  const secret = overrides.cron_secret || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Cron secret not configured. Set CRON_SECRET.' },
      { status: 503 }
    );
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
