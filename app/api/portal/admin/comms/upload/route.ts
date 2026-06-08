/**
 * Admin: загрузка вложения для разовой отправки «Коммуникаций» (email).
 * Файлы: uploads/comms/<uniq>_<name>, суммарно до 10 МБ на запрос.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BATCH_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Файл больше 10 МБ' }, { status: 400 });
  }

  const baseName = path.basename(file.name).replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'file';
  const storedName = `${nanoid(12)}_${baseName}`;
  const relPath = path.join('comms', storedName).replace(/\\/g, '/');
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'comms');
  const fullPath = path.resolve(process.cwd(), 'uploads', relPath);
  if (!fullPath.startsWith(path.resolve(process.cwd(), 'uploads', 'comms'))) {
    return NextResponse.json({ error: 'Недопустимый путь' }, { status: 400 });
  }

  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: 'Файл слишком большой' }, { status: 400 });
  }
  await writeFile(fullPath, buf);

  return NextResponse.json({
    path: relPath,
    name: file.name,
    size: buf.length,
  });
}
