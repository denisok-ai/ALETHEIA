/**
 * Admin: generate product card image via OpenAI DALL·E 3, save to public/uploads/services/.
 * Ключ: Портал → Настройки → Переменные окружения (openai_api_key).
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAdminSession } from '@/lib/auth';
import { getEnvOverrides } from '@/lib/settings';
import { nanoid } from 'nanoid';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export async function POST(request: NextRequest) {
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

  let body: { name?: string; description?: string; courseTitle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Укажите название товара для генерации обложки' }, { status: 400 });
  }
  const desc = typeof body.description === 'string' ? body.description.trim().slice(0, 400) : '';
  const course = typeof body.courseTitle === 'string' ? body.courseTitle.trim().slice(0, 120) : '';

  const prompt =
    `Иллюстрация для карточки образовательной услуги «${name}» на сайте школы мышечного тестирования AVATERRA. ` +
    (course ? `Связь с курсом: ${course}. ` : '') +
    (desc ? `Контекст: ${desc}. ` : '') +
    'Стиль: современный, спокойный, премиальный; фиолетово-золотая палитра допустима; без текста и букв на изображении; ' +
    'абстракция или метафора обучения и тела.';

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
      size: '1024x1024',
      response_format: 'b64_json',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
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
  const safeName = `service-gen-${nanoid(10)}.png`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services');
  const fullPath = path.join(uploadDir, safeName);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(fullPath, buf);

  const url = `/uploads/services/${safeName}`;
  return NextResponse.json({ url });
}
