/**
 * Admin: list SCORM versions for a course; activate a version.
 * GET: list versions
 * POST: { versionId } — activate version (set isActive, update Course)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  let versions;
  try {
    versions = await prisma.scormVersion.findMany({
      where: { courseId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        scormPath: true,
        scormVersion: true,
        fileSize: true,
        notes: true,
        isActive: true,
        uploadedById: true,
        createdAt: true,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('scorm-versions GET:', e);
    return NextResponse.json(
      { error: `База: ${msg}. Выполните prisma migrate deploy на сервере.` },
      { status: 500 }
    );
  }

  if (versions.length === 0) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { scormPath: true, scormVersion: true, scormManifest: true, aiContext: true },
    });
    if (course?.scormPath) {
      const legacy = await prisma.scormVersion.create({
        data: {
          courseId,
          version: 1,
          scormPath: course.scormPath,
          scormVersion: course.scormVersion,
          scormManifest: course.scormManifest,
          aiContext: course.aiContext,
          isActive: true,
        },
      });
      versions = [
        {
          id: legacy.id,
          version: legacy.version,
          scormPath: legacy.scormPath,
          scormVersion: legacy.scormVersion,
          fileSize: legacy.fileSize,
          notes: legacy.notes,
          isActive: legacy.isActive,
          uploadedById: legacy.uploadedById,
          createdAt: legacy.createdAt,
        },
      ];
    }
  }

  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  let body: { versionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { versionId } = body;
  if (!versionId) {
    return NextResponse.json({ error: 'Missing versionId' }, { status: 400 });
  }

  const version = await prisma.scormVersion.findFirst({
    where: { id: versionId, courseId },
  });
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.scormVersion.updateMany({
      where: { courseId },
      data: { isActive: false },
    });
    await tx.scormVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    });
    await tx.course.update({
      where: { id: courseId },
      data: {
        scormPath: version.scormPath,
        scormVersion: version.scormVersion,
        scormManifest: version.scormManifest,
        aiContext: version.aiContext,
      },
    });
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'scorm_activate',
    entity: 'ScormVersion',
    entityId: versionId,
    diff: { courseId, version: version.version },
  });

  return NextResponse.json({ success: true, version: version.version });
}
