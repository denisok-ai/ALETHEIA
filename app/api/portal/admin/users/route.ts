/**
 * Admin: create user (email, password, displayName, role).
 */
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ALLOWED_ROLES = ['user', 'manager', 'admin'];
const MIN_PASSWORD_LENGTH = 6;
const MAX_EMAIL = 255;
const MAX_DISPLAY_NAME = 200;

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { email?: string; password?: string; displayName?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, MAX_EMAIL) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, MAX_DISPLAY_NAME) || null : null;
  const role = body.role && ALLOWED_ROLES.includes(body.role) ? body.role : 'user';

  if (!email) {
    return NextResponse.json({ error: 'Email обязателен' }, { status: 400 });
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
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
      displayName: displayName ?? null,
    },
  });
  await prisma.profile.create({
    data: {
      id: `p-${user.id}`,
      userId: user.id,
      role,
      status: 'active',
      email: user.email,
      displayName: user.displayName,
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
