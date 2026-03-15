/**
 * Admin: upload thumbnail/cover image for a media item.
 * POST with multipart form "file" (image). Saves to public/uploads/media/thumbnails/, updates Media.thumbnailUrl.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mediaId } = await params;
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Размер файла не более 5 МБ' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Допустимы только изображения: JPEG, PNG, GIF, WebP' },
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
  const safeName = `${mediaId}-${nanoid(8)}.${safeExt}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'media', 'thumbnails');
  const fullPath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const thumbnailUrl = `/uploads/media/thumbnails/${safeName}`;
  await prisma.media.update({
    where: { id: mediaId },
    data: { thumbnailUrl },
  });

  return NextResponse.json({ thumbnailUrl });
}
