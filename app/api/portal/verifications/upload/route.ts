/**
 * Student: upload video file for verification. Saves to public/uploads/verifications/, returns URL.
 * Requires enrollment in at least one course (or admin role).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const SAFE_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (role !== 'admin') {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId },
    });
    if (!enrollment) {
      return NextResponse.json({ error: 'Нет доступа к курсам' }, { status: 403 });
    }
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Размер файла не более ${MAX_SIZE / 1024 / 1024} МБ` },
      { status: 400 }
    );
  }
  const isVideo = VIDEO_TYPES.includes(file.type) || file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i);
  if (!isVideo) {
    return NextResponse.json(
      { error: 'Допустимы только видеофайлы (MP4, WebM, MOV, AVI, MKV)' },
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const safeExt = SAFE_EXTS.includes(ext) ? ext : 'mp4';
  const safeName = `${nanoid(10)}.${safeExt}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'verifications');
  const fullPath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const relativeUrl = `/uploads/verifications/${safeName}`;
  const settings = await getSystemSettings();
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const url = siteUrl ? `${siteUrl}${relativeUrl}` : relativeUrl;

  return NextResponse.json({ url });
}
