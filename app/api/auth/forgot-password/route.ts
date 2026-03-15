/**
 * POST: запрос сброса пароля по email.
 * Отправляет письмо со ссылкой /set-password?token=… (тот же поток, что и при конвертации лида).
 * Всегда возвращает success, чтобы не раскрывать наличие email в системе.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { createPasswordToken } from '@/lib/password-token';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/settings';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
    const name = user.displayName || email.split('@')[0];
    const html = `
      <p>Здравствуйте, ${escapeHtml(name)}!</p>
      <p>Вы запросили сброс пароля. Перейдите по ссылке, чтобы установить новый пароль (действует 48 часов):</p>
      <p><a href="${setPasswordUrl}">Установить новый пароль</a></p>
      <p>Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
      <p>— ${settings.portal_title || 'AVATERRA'}</p>
    `;
    await sendEmail(email, 'Сброс пароля — AVATERRA', html);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Forgot password:', e);
    return NextResponse.json({ success: true });
  }
}
