/**
 * Ping для трекинга активности: обновляет lastActivityAt текущей сессии (или создаёт запись посещения).
 * Вызывается при загрузке портала и по таймеру для учёта «онлайн».
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientInfo, recordVisitOrUpdate } from '@/lib/visits';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = getClientInfo(request);
  await recordVisitOrUpdate(userId, client);
  return NextResponse.json({ ok: true });
}
