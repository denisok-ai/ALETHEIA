/**
 * Admin: upload media file to public/uploads/media/ and insert into media table.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string)?.trim() || null;
  const category = (formData.get('category') as string)?.trim() || null;
  const description = (formData.get('description') as string)?.trim() || null;
  const allowDownloadRaw = formData.get('allowDownload');
  const allowDownloadBool = allowDownloadRaw !== 'false';

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeName = `${nanoid(10)}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'media');
  const fullPath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const fileUrl = `/uploads/media/${safeName}`;
  const displayTitle = title || file.name;

  const media = await prisma.media.create({
    data: {
      title: displayTitle,
      fileUrl,
      mimeType: file.type || null,
      category: category || null,
      description: description || null,
      type: 'file',
      allowDownload: allowDownloadBool,
      ownerId: auth.userId ?? null,
    },
  });

  return NextResponse.json({
    media: {
      id: media.id,
      title: media.title,
      file_url: media.fileUrl,
      mime_type: media.mimeType,
      category: media.category,
      type: media.type,
      description: media.description,
      allow_download: media.allowDownload,
      views_count: media.viewsCount,
      rating_sum: media.ratingSum,
      rating_count: media.ratingCount,
      created_at: media.createdAt.toISOString(),
    },
  });
}
