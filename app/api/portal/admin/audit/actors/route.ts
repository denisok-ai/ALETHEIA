/**
 * Admin: list user ids and emails for audit actor filter.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const profiles = await prisma.profile.findMany({
    select: { userId: true, user: { select: { email: true } } },
    orderBy: { userId: 'asc' },
  });

  const users = profiles.map((p) => ({
    id: p.userId,
    email: p.user?.email ?? null,
  }));

  return NextResponse.json({ users });
}
