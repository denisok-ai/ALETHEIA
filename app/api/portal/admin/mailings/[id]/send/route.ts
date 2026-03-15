/**
 * Admin: send mailing now (POST). Only once per mailing; status must be planned.
 * Запускает отправку в фоне и сразу возвращает 202 — статус можно смотреть по polling.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runMailingSend } from '@/lib/mailing-send';

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const mailing = await prisma.mailing.findUnique({ where: { id } });
  if (!mailing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (mailing.status !== 'planned') {
    return NextResponse.json({ error: 'Отправка возможна только для рассылки со статусом «Запланирована». Для повтора используйте «Копировать».' }, { status: 400 });
  }

  runMailingSend(id, auth.userId).catch((e) => {
    console.error('Mailing send background error:', e);
  });

  return NextResponse.json(
    { started: true, message: 'Рассылка запущена. Обновите страницу для просмотра статуса.' },
    { status: 202 }
  );
}
