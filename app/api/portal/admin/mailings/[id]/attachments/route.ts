/**
 * Admin: upload (POST) and delete (DELETE) attachments for a planned mailing.
 * Max total size per mailing: 10 MB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB

type AttachmentEntry = { name: string; pathOrKey: string; size: number };

function parseAttachments(raw: string | null): AttachmentEntry[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? arr.filter((a): a is AttachmentEntry => a && typeof a.name === 'string' && typeof a.pathOrKey === 'string' && typeof a.size === 'number')
      : [];
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mailingId } = await params;
  const mailing = await prisma.mailing.findUnique({ where: { id: mailingId }, select: { id: true, status: true, attachments: true } });
  if (!mailing) return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
  if (mailing.status !== 'planned') {
    return NextResponse.json({ error: 'Вложения можно добавлять только к рассылке со статусом «Запланирована»' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
  }

  const current = parseAttachments(mailing.attachments);
  const currentTotal = current.reduce((s, a) => s + a.size, 0);
  if (currentTotal + file.size > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Превышен лимит вложений (макс. ${MAX_TOTAL_BYTES / 1024 / 1024} МБ). Текущая сумма: ${(currentTotal / 1024 / 1024).toFixed(2)} МБ` },
      { status: 400 }
    );
  }

  const baseName = path.basename(file.name).replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'file';
  const storedName = `${nanoid(10)}_${baseName}`;
  const relPath = path.join('mailings', mailingId, storedName);
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'mailings', mailingId);
  const fullPath = path.resolve(process.cwd(), 'uploads', relPath);
  if (!fullPath.startsWith(path.resolve(process.cwd(), 'uploads'))) {
    return NextResponse.json({ error: 'Недопустимое имя файла' }, { status: 400 });
  }

  await mkdir(uploadDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buf);

  const entry: AttachmentEntry = { name: file.name, pathOrKey: relPath.replace(/\\/g, '/'), size: file.size };
  const nextList = [...current, entry];
  await prisma.mailing.update({
    where: { id: mailingId },
    data: { attachments: JSON.stringify(nextList) },
  });

  return NextResponse.json({
    attachments: nextList,
    added: { name: entry.name, pathOrKey: entry.pathOrKey, size: entry.size },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mailingId } = await params;
  const mailing = await prisma.mailing.findUnique({ where: { id: mailingId }, select: { id: true, status: true, attachments: true } });
  if (!mailing) return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
  if (mailing.status !== 'planned') {
    return NextResponse.json({ error: 'Вложения можно удалять только у рассылки со статусом «Запланирована»' }, { status: 400 });
  }

  let body: { pathOrKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const pathOrKey = typeof body.pathOrKey === 'string' ? body.pathOrKey.trim() : '';
  if (!pathOrKey) return NextResponse.json({ error: 'Укажите pathOrKey вложения' }, { status: 400 });

  const current = parseAttachments(mailing.attachments);
  const nextList = current.filter((a) => a.pathOrKey !== pathOrKey);
  if (nextList.length === current.length) {
    return NextResponse.json({ error: 'Вложение не найдено' }, { status: 404 });
  }

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const fullPath = path.resolve(process.cwd(), 'uploads', pathOrKey);
  if (!fullPath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: 'Недопустимый путь' }, { status: 400 });
  }
  try {
    await unlink(fullPath);
  } catch {
    // файл уже удалён — продолжаем
  }

  await prisma.mailing.update({
    where: { id: mailingId },
    data: { attachments: nextList.length > 0 ? JSON.stringify(nextList) : null },
  });

  return NextResponse.json({ attachments: nextList });
}
