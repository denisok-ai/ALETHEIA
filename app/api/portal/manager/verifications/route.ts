/**
 * Manager: approve/reject phygital verification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== 'manager' && role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { id: string; status: 'approved' | 'rejected' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  await prisma.phygitalVerification.update({
    where: { id: body.id },
    data: {
      status: body.status === 'approved' ? 'approved' : 'rejected',
      reviewedBy: userId ?? null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
