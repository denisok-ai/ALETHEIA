/**
 * Admin: upload product card image for Service. Saves to public/uploads/services/, returns URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAdminSession } from '@/lib/auth';
import { nanoid } from 'nanoid';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  const safeName = `service-${nanoid(12)}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services');
  const fullPath = path.join(uploadDir, safeName);
  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const url = `/uploads/services/${safeName}`;
  return NextResponse.json({ url });
}
