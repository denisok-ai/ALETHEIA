/**
 * Admin: list users for recipient selection (email, displayName, telegramId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const profiles = await prisma.profile.findMany({
    where: { status: 'active' },
    include: { user: { select: { email: true } } },
    orderBy: { displayName: 'asc' },
  });

  const users = profiles.map((p) => ({
    id: p.userId,
    email: p.email ?? p.user.email ?? null,
    displayName: p.displayName ?? p.user.email ?? p.userId,
    telegramId: p.telegramId,
  }));

  return NextResponse.json({ users });
}
