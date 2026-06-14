/**
 * Admin: update user (role, status, profile fields including telegramId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { profileUpdateSchema } from '@/lib/validations/profile';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Неверные данные';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const profileUpdates: {
    role?: string;
    status?: string;
    displayName?: string | null;
    email?: string | null;
    telegramId?: number | null;
  } = {};

  if (parsed.data.role) profileUpdates.role = parsed.data.role;
  if (parsed.data.status) profileUpdates.status = parsed.data.status;
  if (parsed.data.displayName !== undefined) {
    profileUpdates.displayName =
      parsed.data.displayName === '' || parsed.data.displayName === null
        ? null
        : parsed.data.displayName.trim() || null;
  }
  if (parsed.data.email !== undefined) {
    profileUpdates.email =
      parsed.data.email === '' || parsed.data.email === null ? null : parsed.data.email.trim() || null;
  }
  if (parsed.data.telegramId !== undefined) {
    if (parsed.data.telegramId === '' || parsed.data.telegramId === null) {
      profileUpdates.telegramId = null;
    } else {
      const taken = await prisma.profile.findFirst({
        where: { telegramId: parsed.data.telegramId, userId: { not: id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: 'Этот Telegram ID уже привязан к другому аккаунту.' }, { status: 409 });
      }
      profileUpdates.telegramId = parsed.data.telegramId;
    }
  }

  if (Object.keys(profileUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx) => {
    const p = await tx.profile.update({
      where: { userId: id },
      data: profileUpdates,
    });
    if (parsed.data.displayName !== undefined) {
      await tx.user.update({
        where: { id },
        data: { displayName: profileUpdates.displayName ?? null },
      });
    }
    return p;
  });
  return NextResponse.json({ profile });
}
