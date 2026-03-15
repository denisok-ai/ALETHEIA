/**
 * Admin: upload media file to public/uploads/media/ and insert into media table.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

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
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `Размер файла не более ${MAX_SIZE / 1024 / 1024} МБ` }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Недопустимый тип файла. Разрешены: изображения, PDF, видео, аудио, текст, Word.' },
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'mp4', 'webm', 'mp3', 'wav', 'txt', 'doc', 'docx'];
  const safeExt = safeExts.includes(ext) ? ext : 'bin';
  const safeName = `${nanoid(10)}.${safeExt}`;
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
