/**
 * Admin: send mailing now (POST). Only once per mailing; status must be planned.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runMailingSend } from '@/lib/mailing-send';

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

  const result = await runMailingSend(id, auth.userId);
  if (!result) {
    return NextResponse.json({ error: 'Рассылка не найдена или уже отправлена' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    sent: result.sent,
    failed: result.failed,
    total: result.total,
  });
}
