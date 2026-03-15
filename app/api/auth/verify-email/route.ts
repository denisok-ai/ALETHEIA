/**
 * POST: подтверждение email по токену.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getUserIdByEmailVerificationToken,
  consumeEmailVerificationToken,
} from '@/lib/email-verification';
import { triggerNotification } from '@/lib/notifications';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'verify-email', 10);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Токен не указан' }, { status: 400 });
    }

    const userId = await getUserIdByEmailVerificationToken(token);
    if (!userId) {
      return NextResponse.json({ error: 'Токен недействителен или истёк' }, { status: 400 });
    }

    const consumed = await consumeEmailVerificationToken(token);
    if (!consumed) {
      return NextResponse.json({ error: 'Токен уже использован' }, { status: 400 });
    }

    await prisma.profile.update({
      where: { userId },
      data: { emailVerifiedAt: new Date() },
    });

    try {
      await triggerNotification({ eventType: 'welcome', userId });
    } catch (welcomeErr) {
      console.error('Verify email: welcome notification', welcomeErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Verify email:', e);
    return NextResponse.json({ error: 'Ошибка подтверждения' }, { status: 500 });
  }
}
