/**
 * Admin: list users (GET) with pagination and search, create user (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validatePassword } from '@/lib/password-validation';

const ALLOWED_ROLES = ['user', 'manager', 'admin'];
const MAX_EMAIL = 255;
const MAX_DISPLAY_NAME = 200;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
  const q = searchParams.get('q')?.trim() ?? '';
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { displayName: { contains: q } },
          { profile: { displayName: { contains: q } } },
          { profile: { email: { contains: q } } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        profile: { select: { displayName: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.profile?.displayName ?? u.displayName ?? null,
  }));

  return NextResponse.json({ users: result, total, page, limit });
}

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
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
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
      emailVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
