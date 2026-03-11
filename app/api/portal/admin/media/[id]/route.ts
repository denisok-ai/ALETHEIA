/**
 * Admin: get (GET), update (PATCH), delete (DELETE) one media item.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { mediaUpdateSchema } from '@/lib/validations/media';
import { unlink } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    media: {
      id: media.id,
      title: media.title,
      fileUrl: media.fileUrl,
      mimeType: media.mimeType,
      category: media.category,
      description: media.description,
      type: media.type,
      viewsCount: media.viewsCount,
      allowDownload: media.allowDownload,
      ratingSum: media.ratingSum,
      ratingCount: media.ratingCount,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = mediaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const data: { title?: string; category?: string | null; description?: string | null; courseId?: string | null; allowDownload?: boolean } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.courseId !== undefined) data.courseId = parsed.data.courseId;
  if (parsed.data.allowDownload !== undefined) data.allowDownload = parsed.data.allowDownload;

  const media = await prisma.media.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'media.update',
    entity: 'Media',
    entityId: id,
    diff: data,
  });

  return NextResponse.json({
    media: {
      id: media.id,
      title: media.title,
      file_url: media.fileUrl,
      mime_type: media.mimeType,
      category: media.category,
      description: media.description,
      type: media.type,
      allow_download: media.allowDownload,
      views_count: media.viewsCount,
      rating_sum: media.ratingSum,
      rating_count: media.ratingCount,
      created_at: media.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.type === 'file' && existing.fileUrl.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), 'public', existing.fileUrl.replace(/^\//, ''));
    try {
      await unlink(filePath);
    } catch {
      // file may already be missing
    }
  }

  await prisma.media.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'media.delete',
    entity: 'Media',
    entityId: id,
    diff: { title: existing.title, fileUrl: existing.fileUrl },
  });

  return NextResponse.json({ success: true });
}
