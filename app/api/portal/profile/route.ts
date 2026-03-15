/**
 * Student (own) profile: GET and PATCH displayName.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { profilePatchSchema } from '@/lib/validations/profile';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, email: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return NextResponse.json({
    displayName: profile?.displayName ?? null,
    email: profile?.email ?? user?.email ?? null,
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

  await prisma.profile.upsert({
    where: { userId },
    create: { id: `p-${userId}`, userId, displayName: displayName ?? undefined },
    update: displayName !== undefined ? { displayName } : {},
  });

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  return NextResponse.json({ displayName: profile?.displayName ?? null });
}
