/**
 * Публичный API отписки от рассылок: сохраняет email в MailingUnsubscribe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = body.email;
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'Укажите адрес электронной почты' }, { status: 400 });
  }
  const email = normalizeEmail(raw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный формат email' }, { status: 400 });
  }

  try {
    await prisma.mailingUnsubscribe.create({ data: { email } });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2002') {
      // уже отписан
    } else {
      throw e;
    }
  }

  return NextResponse.json({ success: true, message: 'Вы отписаны от рассылок' });
}
