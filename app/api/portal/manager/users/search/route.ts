/**
 * Manager: search profiles by email or display_name.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ profiles: [] });

  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { email: { contains: q } },
        { displayName: { contains: q } },
      ],
    },
    include: { user: { select: { email: true } } },
    take: 50,
  });

  const result = profiles.map((p) => ({
    id: p.userId,
    display_name: p.displayName,
    email: p.email ?? p.user.email,
    role: p.role,
    status: p.status,
    created_at: p.createdAt.toISOString(),
  }));

  return NextResponse.json({ profiles: result });
}
