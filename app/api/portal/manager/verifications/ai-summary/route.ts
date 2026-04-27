/**
 * Менеджер: краткая AI-подсказка по заданию на верификацию (не заменяет решение человека).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLlmApiKey } from '@/lib/llm';
import { logLlmRequest } from '@/lib/llm-request-log';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const SYSTEM = `Ты помощник проверяющего в школе AVATERRA. Дай только краткое резюме и ориентиры для проверки (3–6 пунктов), без финального вердикта «зачёт/незачёт». Без медицинских диагнозов. По-русски.`;

export async function POST(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { verificationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const verificationId = typeof body.verificationId === 'string' ? body.verificationId.trim() : '';
  if (!verificationId) {
    return NextResponse.json({ error: 'Укажите verificationId' }, { status: 400 });
  }

  const v = await prisma.phygitalVerification.findUnique({
    where: { id: verificationId },
    include: { course: { select: { title: true } } },
  });
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return NextResponse.json({ error: 'Настройте API-ключ LLM в разделе «Настройки AI»' }, { status: 503 });
  }

  const settings = await prisma.llmSetting.findUnique({ where: { key: 'chatbot' } });
  const model = settings?.model ?? 'deepseek-chat';

  const typeLabel = v.assignmentType === 'text' ? 'текстовый ответ' : 'видео (ссылка или файл)';
  const userContent = `Курс: «${v.course?.title ?? v.courseId}». Урок/элемент: ${v.lessonId ?? 'не указан'}.
Тип задания: ${typeLabel}.
Содержимое (то, что прислал слушатель):
---
${v.videoUrl.slice(0, 12000)}
---

Сформулируй краткое резюме для проверяющего: на что обратить внимание, возможные риски несоответствия формулировке задания.`;

  const startMs = Date.now();
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
      max_tokens: 900,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Ошибка вызова модели' }, { status: 502 });
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

  logLlmRequest({
    source: 'verification-ai-summary',
    model,
    promptChars: SYSTEM.length + userContent.length,
    responseChars: content.length,
    durationMs: Date.now() - startMs,
    userId: auth.userId,
    role: auth.role,
  });

  return NextResponse.json({ content });
}
