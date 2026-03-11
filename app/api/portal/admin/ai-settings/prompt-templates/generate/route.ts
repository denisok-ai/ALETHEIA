/**
 * Admin: generate prompt template text using LLM (chatbot key).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getLlmApiKey } from '@/lib/llm';
import { prisma } from '@/lib/db';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { instruction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  if (!instruction) {
    return NextResponse.json({ error: 'Укажите описание или инструкцию для генерации промпта' }, { status: 400 });
  }

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return NextResponse.json({ error: 'Настройте API-ключ в блоке «Ключи моделей»' }, { status: 503 });
  }

  const settings = await prisma.llmSetting.findUnique({ where: { key: 'chatbot' } });
  const model = settings?.model ?? 'deepseek-chat';
  const sys = 'Ты помогаешь создавать system prompt для консультанта курса «Тело не врёт» (школа мышечного тестирования). Ответь только текстом самого промпта, без пояснений и кавычек.';

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: instruction },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ и модель.' },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

  return NextResponse.json({ content });
}
