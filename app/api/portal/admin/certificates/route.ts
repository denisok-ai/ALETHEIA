/**
 * Admin: list certificates (optional filter by courseId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId')?.trim() || undefined;

  const certs = await prisma.certificate.findMany({
    where: courseId ? { courseId } : undefined,
    include: {
      course: { select: { id: true, title: true } },
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { issuedAt: 'desc' },
  });

  const list = certs.map((c) => ({
    id: c.id,
    certNumber: c.certNumber,
    courseId: c.courseId,
    courseTitle: c.course?.title ?? null,
    userId: c.userId,
    userEmail: c.user.email,
    displayName: c.user.profile?.displayName ?? null,
    issuedAt: c.issuedAt.toISOString(),
    revokedAt: c.revokedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ certificates: list });
}
