/**
 * Admin: upload course cover image (POST). Saves to public/uploads/courses/, returns URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });

  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Размер файла не более 5 МБ' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Допустимы только JPEG, PNG, GIF, WebP' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'Недопустимое расширение' }, { status: 400 });
  }
  const safeName = `cover-${courseId.slice(-8)}-${nanoid(8)}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'courses');
  const fullPath = path.join(uploadDir, safeName);
  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const url = `/uploads/courses/${safeName}`;

  await prisma.course.update({
    where: { id: courseId },
    data: { thumbnailUrl: url },
  });

  return NextResponse.json({ url });
}
