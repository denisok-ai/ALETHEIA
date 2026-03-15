/**
 * Manager: approve/reject phygital verification.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { id: string; status: 'approved' | 'rejected'; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) || null : null;

  await prisma.phygitalVerification.update({
    where: { id: body.id },
    data: {
      status: body.status === 'approved' ? 'approved' : 'rejected',
      reviewedBy: auth.userId ?? null,
      reviewedAt: new Date(),
      ...(body.status === 'rejected' && comment !== undefined && { comment }),
    },
  });

  return NextResponse.json({ success: true });
}
