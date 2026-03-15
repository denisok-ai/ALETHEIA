/**
 * POST: повторная отправка письма верификации (для авторизованных пользователей).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createEmailVerificationToken } from '@/lib/email-verification';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rate-limit';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'resend-verification', 3);
  if (rateLimitRes) return rateLimitRes;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { emailVerifiedAt: true },
  });
  if (!profile || profile.emailVerifiedAt) {
    return NextResponse.json({ error: 'Email уже подтверждён' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: 'Email не найден' }, { status: 400 });
  }

  try {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    const token = await createEmailVerificationToken(userId);
    const settings = await getSystemSettings();
    const siteUrl = settings.site_url?.replace(/\/$/, '') || process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') || '';
    const verifyUrl = siteUrl
      ? `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`
      : `/verify-email?token=${encodeURIComponent(token)}`;
    const displayName = user.displayName || user.email.split('@')[0];
    const html = `
      <p>Здравствуйте, ${escapeHtml(displayName)}!</p>
      <p>Подтвердите ваш email, перейдя по ссылке (действует 48 часов):</p>
      <p><a href="${verifyUrl}">Подтвердить email</a></p>
      <p>Если вы не запрашивали это письмо, проигнорируйте его.</p>
      <p>— ${settings.portal_title || 'AVATERRA'}</p>
    `;
    await sendEmail(user.email, `Подтверждение email — ${settings.portal_title || 'AVATERRA'}`, html);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Resend verification:', e);
    return NextResponse.json({ error: 'Ошибка отправки письма' }, { status: 500 });
  }
}
