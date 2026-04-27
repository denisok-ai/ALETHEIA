/**
 * Admin: generate course cover image via OpenAI DALL-E 3, save to uploads, update course.
 * API ключ: из БД (Портал → Настройки → Переменные окружения). Настройки вынесены в админку.
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEnvOverrides } from '@/lib/settings';
import { nanoid } from 'nanoid';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overrides = await getEnvOverrides();
  const apiKey = overrides.openai_api_key?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Задайте OpenAI API ключ в Портал → Настройки → Переменные окружения' },
      { status: 503 }
    );
  }

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, description: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const title = course.title?.trim() || 'Онлайн-курс';
  const desc = course.description?.trim()?.slice(0, 300) || '';
  const prompt =
    `Обложка для онлайн-курса «${title}». ${desc ? `Контекст: ${desc}. ` : ''}` +
    'Стиль: современный, лаконичный, профессиональный баннер для образовательной платформы. ' +
    'Без текста на изображении. Соответствующая тематике курса иллюстрация или абстракция.';

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    return NextResponse.json(
      { error: 'Ошибка генерации изображения. Проверьте ключ и лимиты OpenAI.' },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    return NextResponse.json({ error: 'Нет данных изображения в ответе' }, { status: 502 });
  }

  const buf = Buffer.from(b64, 'base64');
  const safeName = `cover-${courseId.slice(-8)}-${nanoid(8)}.png`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'courses');
  const fullPath = path.join(uploadDir, safeName);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(fullPath, buf);

  const url = `/uploads/courses/${safeName}`;

  await prisma.course.update({
    where: { id: courseId },
    data: { thumbnailUrl: url },
  });

  return NextResponse.json({ url });
}
