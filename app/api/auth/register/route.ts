import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { triggerNotification } from '@/lib/notifications';
import { claimPaidOrdersForUser } from '@/lib/claim-orders';

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль не менее 6 символов' }, { status: 400 });
    }
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
        displayName: name || null,
      },
    });
    await prisma.profile.create({
      data: {
        id: `p-${user.id}`,
        userId: user.id,
        role: 'user',
        status: 'active',
        email: user.email,
        displayName: user.displayName,
      },
    });
    try {
      await claimPaidOrdersForUser(user.id, emailNorm);
    } catch (claimErr) {
      console.error('Register: claim paid orders', claimErr);
    }
    try {
      await triggerNotification({ eventType: 'welcome', userId: user.id });
    } catch (welcomeErr) {
      console.error('Register: welcome notification', welcomeErr);
    }
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 });
  }
}
