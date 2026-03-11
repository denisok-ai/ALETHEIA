/**
 * Student (own) profile: GET and PATCH displayName.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

  let body: { displayName?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const displayName = body.displayName === undefined ? undefined : (body.displayName === '' || body.displayName === null ? null : String(body.displayName).trim());

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
