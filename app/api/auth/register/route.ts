import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль не менее 6 символов' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 400 });
    }
    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
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
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 });
  }
}
