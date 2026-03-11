/**
 * Admin: list (GET) and create (POST) certificate templates.
 * POST: JSON or multipart (name, optional file=подложка, textMapping, courseId, minScore, ...).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.certificateTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { certificates: true } },
    },
  });

  return NextResponse.json({
    templates: list.map((t) => ({
      id: t.id,
      name: t.name,
      backgroundImageUrl: t.backgroundImageUrl,
      textMapping: t.textMapping,
      courseId: t.courseId,
      courseTitle: t.course?.title ?? null,
      minScore: t.minScore,
      requiredStatus: t.requiredStatus,
      validityDays: t.validityDays,
      numberingFormat: t.numberingFormat,
      allowUserDownload: t.allowUserDownload,
      createdAt: t.createdAt.toISOString(),
      certificatesCount: t._count.certificates,
    })),
  });
}

async function createFromJson(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Укажите название шаблона' }, { status: 400 });

  const courseId = body.courseId === null || body.courseId === '' ? null : (typeof body.courseId === 'string' ? body.courseId.trim() : null);
  const minScore = typeof body.minScore === 'number' && body.minScore >= 0 && body.minScore <= 100 ? body.minScore : null;
  const requiredStatus = body.requiredStatus === null || body.requiredStatus === '' ? null : (typeof body.requiredStatus === 'string' ? body.requiredStatus.trim() : null);
  const validityDays = typeof body.validityDays === 'number' && body.validityDays > 0 ? body.validityDays : null;
  const numberingFormat = body.numberingFormat === null || body.numberingFormat === '' ? null : (typeof body.numberingFormat === 'string' ? body.numberingFormat.trim() : null);
  const allowUserDownload = body.allowUserDownload !== false;
  const textMapping = body.textMapping === null || body.textMapping === '' ? null : (typeof body.textMapping === 'string' ? body.textMapping.trim() : null);

  if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 400 });
  }

  const template = await prisma.certificateTemplate.create({
    data: {
      name,
      courseId,
      minScore,
      requiredStatus,
      validityDays,
      numberingFormat,
      allowUserDownload,
      textMapping: textMapping || undefined,
    },
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
    createdAt: template.createdAt.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim() || '';
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

    if (!name) return NextResponse.json({ error: 'Укажите название шаблона' }, { status: 400 });
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 400 });
    }

    let backgroundImageUrl: string | null = null;
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
      backgroundImageUrl = `/uploads/certificates/${safeName}`;
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name,
        backgroundImageUrl,
        textMapping: textMapping || undefined,
        courseId: courseId || null,
        minScore: minScore !== null && minScore >= 0 && minScore <= 100 ? minScore : null,
        requiredStatus,
        validityDays: validityDays !== null && validityDays > 0 ? validityDays : null,
        numberingFormat,
        allowUserDownload,
      },
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
      createdAt: template.createdAt.toISOString(),
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  return createFromJson(body);
}
