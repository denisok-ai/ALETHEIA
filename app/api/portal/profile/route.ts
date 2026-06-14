/**
 * Student (own) profile: GET and PATCH displayName, telegramId.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { profilePatchSchema } from '@/lib/validations/profile';

async function assertTelegramIdAvailable(telegramId: number, userId: string): Promise<string | null> {
  const taken = await prisma.profile.findFirst({
    where: { telegramId, userId: { not: userId } },
    select: { id: true },
  });
  return taken ? 'Этот Telegram ID уже привязан к другому аккаунту.' : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, email: true, telegramId: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return NextResponse.json({
    displayName: profile?.displayName ?? null,
    email: profile?.email ?? user?.email ?? null,
    telegramId: profile?.telegramId ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Неверные данные';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const displayName =
    parsed.data.displayName === undefined
      ? undefined
      : parsed.data.displayName === '' || parsed.data.displayName === null
        ? null
        : String(parsed.data.displayName).trim();

  let telegramId: number | null | undefined;
  if (parsed.data.telegramId !== undefined) {
    if (parsed.data.telegramId === '' || parsed.data.telegramId === null) {
      telegramId = null;
    } else {
      telegramId = parsed.data.telegramId;
      const conflict = await assertTelegramIdAvailable(telegramId, userId);
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    }
  }

  const updateData: { displayName?: string | null; telegramId?: number | null } = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (telegramId !== undefined) updateData.telegramId = telegramId;

  await prisma.profile.upsert({
    where: { userId },
    create: { id: `p-${userId}`, userId, ...updateData },
    update: updateData,
  });

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, telegramId: true },
  });
  return NextResponse.json({
    displayName: profile?.displayName ?? null,
    telegramId: profile?.telegramId ?? null,
  });
}
