/**
 * Admin: get (GET), update (PATCH), delete (DELETE) a certificate template.
 * PATCH: JSON or multipart (optional file = новая подложка, textMapping, ...).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const template = await prisma.certificateTemplate.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { certificates: true } },
    },
  });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    backgroundImageUrl: template.backgroundImageUrl,
    textMapping: template.textMapping,
    courseId: template.courseId,
    course: template.course,
    minScore: template.minScore,
    requiredStatus: template.requiredStatus,
    validityDays: template.validityDays,
    numberingFormat: template.numberingFormat,
    allowUserDownload: template.allowUserDownload,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    certificatesCount: template._count.certificates,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const file = formData.get('file') as File | null;
    const textMapping = (formData.get('textMapping') as string)?.trim() || null;
    const courseId = (formData.get('courseId') as string)?.trim() || null;
    const minScoreRaw = formData.get('minScore');
    const minScore = minScoreRaw !== null && minScoreRaw !== '' ? parseInt(String(minScoreRaw), 10) : null;
    const requiredStatus = (formData.get('requiredStatus') as string)?.trim() || null;
    const validityDaysRaw = formData.get('validityDays');
    const validityDays = validityDaysRaw !== null && validityDaysRaw !== '' ? parseInt(String(validityDaysRaw), 10) : null;
    const numberingFormat = (formData.get('numberingFormat') as string)?.trim() || null;
    const allowUserDownload = formData.get('allowUserDownload') !== 'false';
    const removeBackground = formData.get('removeBackground') === 'true';

    const update: {
      name?: string;
      backgroundImageUrl?: string | null;
      textMapping?: string | null;
      courseId?: string | null;
      minScore?: number | null;
      requiredStatus?: string | null;
      validityDays?: number | null;
      numberingFormat?: string | null;
      allowUserDownload?: boolean;
    } = {};
    if (name) update.name = name;
    if (textMapping !== undefined) update.textMapping = textMapping;
    if (courseId !== undefined) update.courseId = courseId || null;
    if (minScore !== undefined) update.minScore = minScore !== null && minScore >= 0 && minScore <= 100 ? minScore : null;
    if (requiredStatus !== undefined) update.requiredStatus = requiredStatus;
    if (validityDays !== undefined) update.validityDays = validityDays !== null && validityDays > 0 ? validityDays : null;
    if (numberingFormat !== undefined) update.numberingFormat = numberingFormat;
    if (typeof allowUserDownload === 'boolean') update.allowUserDownload = allowUserDownload;
    if (removeBackground) update.backgroundImageUrl = null;
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      if (!['png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
        return NextResponse.json({ error: 'Допустимы только PNG, JPG, PDF' }, { status: 400 });
      }
      const safeName = `${nanoid(10)}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'certificates');
      const fullPath = path.join(uploadDir, safeName);
      await mkdir(uploadDir, { recursive: true });
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(fullPath, buf);
      update.backgroundImageUrl = `/uploads/certificates/${safeName}`;
    }

    if (update.courseId && typeof update.courseId === 'string') {
      const course = await prisma.course.findUnique({ where: { id: update.courseId } });
      if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 400 });
    }

    const template = await prisma.certificateTemplate.update({
      where: { id },
      data: update,
    });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      backgroundImageUrl: template.backgroundImageUrl,
      textMapping: template.textMapping,
      courseId: template.courseId,
      minScore: template.minScore,
      requiredStatus: template.requiredStatus,
      validityDays: template.validityDays,
      numberingFormat: template.numberingFormat,
      allowUserDownload: template.allowUserDownload,
      updatedAt: template.updatedAt.toISOString(),
    });
  }

  let body: {
    name?: string;
    backgroundImageUrl?: string | null;
    textMapping?: string | null;
    courseId?: string | null;
    minScore?: number | null;
    requiredStatus?: string | null;
    validityDays?: number | null;
    numberingFormat?: string | null;
    allowUserDownload?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    const t = body.name.trim();
    if (t) update.name = t;
  }
  if (body.backgroundImageUrl !== undefined) update.backgroundImageUrl = body.backgroundImageUrl;
  if (body.textMapping !== undefined) update.textMapping = body.textMapping === null || body.textMapping === '' ? null : body.textMapping;
  if (body.courseId !== undefined) update.courseId = body.courseId === null || body.courseId === '' ? null : body.courseId;
  if (body.minScore !== undefined) update.minScore = typeof body.minScore === 'number' && body.minScore >= 0 && body.minScore <= 100 ? body.minScore : null;
  if (body.requiredStatus !== undefined) update.requiredStatus = body.requiredStatus === null || body.requiredStatus === '' ? null : body.requiredStatus;
  if (body.validityDays !== undefined) update.validityDays = typeof body.validityDays === 'number' && body.validityDays > 0 ? body.validityDays : null;
  if (body.numberingFormat !== undefined) update.numberingFormat = body.numberingFormat === null || body.numberingFormat === '' ? null : body.numberingFormat;
  if (typeof body.allowUserDownload === 'boolean') update.allowUserDownload = body.allowUserDownload;

  if (update.courseId && typeof update.courseId === 'string') {
    const course = await prisma.course.findUnique({ where: { id: update.courseId } });
    if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 400 });
  }

  const template = await prisma.certificateTemplate.update({
    where: { id },
    data: update,
  });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    backgroundImageUrl: template.backgroundImageUrl,
    textMapping: template.textMapping,
    courseId: template.courseId,
    minScore: template.minScore,
    requiredStatus: template.requiredStatus,
    validityDays: template.validityDays,
    numberingFormat: template.numberingFormat,
    allowUserDownload: template.allowUserDownload,
    updatedAt: template.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.certificateTemplate.findUnique({
    where: { id },
    include: { _count: { select: { certificates: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing._count.certificates > 0) {
    return NextResponse.json(
      { error: 'Шаблон используется в выданных сертификатах. Удаление невозможно.' },
      { status: 400 }
    );
  }

  await prisma.certificateTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
