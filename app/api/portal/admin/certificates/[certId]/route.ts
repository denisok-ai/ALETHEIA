/**
 * Admin: get certificate details (GET), revoke (PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { certId } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { id: certId },
    include: {
      course: { select: { id: true, title: true } },
      user: {
        include: { profile: { select: { displayName: true } } },
        select: { id: true, email: true },
      },
    },
  });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    certificate: {
      id: cert.id,
      certNumber: cert.certNumber,
      courseId: cert.courseId,
      courseTitle: cert.course?.title ?? null,
      userId: cert.userId,
      userEmail: cert.user.email,
      displayName: cert.user.profile?.displayName ?? null,
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { certId } = await params;
  let body: { revoked?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.revoked !== true) {
    return NextResponse.json({ error: 'Expected { revoked: true }' }, { status: 400 });
  }

  const cert = await prisma.certificate.findUnique({ where: { id: certId } });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cert.revokedAt) return NextResponse.json({ error: 'Уже аннулирован' }, { status: 400 });

  const updated = await prisma.certificate.update({
    where: { id: certId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({
    certificate: {
      id: updated.id,
      revokedAt: updated.revokedAt?.toISOString() ?? null,
    },
  });
}
