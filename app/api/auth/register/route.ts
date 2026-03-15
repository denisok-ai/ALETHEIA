import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { triggerNotification } from '@/lib/notifications';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';
import { checkRateLimit } from '@/lib/rate-limit';
import { createEmailVerificationToken } from '@/lib/email-verification';
import { sendEmail } from '@/lib/email';
import { getSystemSettings } from '@/lib/settings';
import { registerSchema } from '@/lib/validations/auth';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function isEmailVerificationEnabled(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: 'email_verification_enabled' },
  });
  if (!row) return true;
  return row.value !== 'false' && row.value !== '0';
}

export async function POST(req: Request) {
  const rateLimitRes = checkRateLimit(req, 'register', 3);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse({ ...body, displayName: body?.displayName ?? body?.name ?? null });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Неверные данные';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email, password, displayName } = parsed.data;
    const emailNorm = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 400 });
    }
    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        displayName: displayName ?? null,
      },
    });

    const verificationRequired = await isEmailVerificationEnabled();
    const emailVerifiedAt = verificationRequired ? null : new Date();

    await prisma.profile.create({
      data: {
        id: `p-${user.id}`,
        userId: user.id,
        role: 'user',
        status: 'active',
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt,
      },
    });
    try {
      await claimPaidOrdersForUser(user.id, emailNorm);
    } catch (claimErr) {
      console.error('Register: claim paid orders', claimErr);
    }

    if (verificationRequired) {
      try {
        const token = await createEmailVerificationToken(user.id);
        const settings = await getSystemSettings();
        const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
        const verifyUrl = siteUrl
          ? `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`
          : `/verify-email?token=${encodeURIComponent(token)}`;
        const displayName = user.displayName || emailNorm.split('@')[0];
        const html = `
          <p>Здравствуйте, ${escapeHtml(displayName)}!</p>
          <p>Подтвердите ваш email, перейдя по ссылке (действует 48 часов):</p>
          <p><a href="${verifyUrl}">Подтвердить email</a></p>
          <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
          <p>— ${settings.portal_title || 'AVATERRA'}</p>
        `;
        await sendEmail(emailNorm, `Подтверждение email — ${settings.portal_title || 'AVATERRA'}`, html);
      } catch (emailErr) {
        console.error('Register: verification email', emailErr);
      }
    } else {
      try {
        await triggerNotification({ eventType: 'welcome', userId: user.id });
      } catch (welcomeErr) {
        console.error('Register: welcome notification', welcomeErr);
      }
    }
    return NextResponse.json({ ok: true, userId: user.id, emailVerificationRequired: verificationRequired });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 });
  }
}
