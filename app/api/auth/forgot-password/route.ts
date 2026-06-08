/**
 * POST: запрос сброса пароля по email.
 * Отправляет письмо со ссылкой /set-password?token=… (тот же поток, что и при конвертации лида).
 * Всегда возвращает success, чтобы не раскрывать наличие email в системе.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { createPasswordToken } from '@/lib/password-token';
import { sendTransactionalEmail } from '@/lib/email-service';
import { buildPasswordResetEmail } from '@/lib/email-templates';
import { getSystemSettings } from '@/lib/settings';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'forgot-password', 5);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, displayName: true },
    });
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = await createPasswordToken(user.id);
    const settings = await getSystemSettings();
    const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
    const setPasswordUrl = siteUrl
      ? `${siteUrl}/set-password?token=${encodeURIComponent(token)}`
      : `/set-password?token=${encodeURIComponent(token)}`;
    const name = user.displayName ?? '';
    const passwordEmail = buildPasswordResetEmail({
      displayName: name,
      setPasswordUrl,
      systemTitle: settings.portal_title || 'AVATERRA',
    });
    await sendTransactionalEmail({
      to: email,
      subject: passwordEmail.subject,
      html: passwordEmail.html,
      context: { module: 'auth', entityId: user.id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Forgot password:', e);
    return NextResponse.json({ success: true });
  }
}
