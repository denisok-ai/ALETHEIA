/**
 * Admin: generate prompt template text using LLM (chatbot key).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getLlmApiKey } from '@/lib/llm';
import { completeLlmChat, resolveChatbotProvider } from '@/lib/llm-chat-completion';
import { getEnvOverrides } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logLlmRequest } from '@/lib/llm-request-log';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { instruction?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const scope = body.scope === 'course-tutor' ? 'course-tutor' : 'chatbot';
  if (!instruction) {
    return NextResponse.json({ error: 'Укажите описание или инструкцию для генерации промпта' }, { status: 400 });
  }

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return NextResponse.json({ error: 'Настройте API-ключ в блоке «Ключи моделей»' }, { status: 503 });
  }

  const settings = await prisma.llmSetting.findUnique({
    where: { key: 'chatbot' },
    include: { apiKey: { select: { provider: true } } },
  });
  const envOverrides = await getEnvOverrides();
  const provider = resolveChatbotProvider(settings, envOverrides);
  let model = settings?.model ?? 'deepseek-chat';
  if (!settings) {
    if (provider === 'openai') model = 'gpt-4o-mini';
    else if (provider === 'anthropic') model = 'claude-3-5-haiku-20240307';
  }
  const sys =
    scope === 'course-tutor'
      ? 'Ты помогаешь создавать playbook (инструкцию) для AI-тьютора в онлайн-курсе: ответы только по материалам уроков, без выдумывания; при необходимости — направить к куратору. Школа — мышечное тестирование, курс «Тело не врёт». Можно использовать плейсхолдеры {{PORTAL_URL}}, {{PORTAL_COURSE_URL}}, {{SUPPORT_EMAIL}}, {{PRICING_URL}} и т.п. Ответь только текстом промпта, без пояснений и кавычек.'
      : 'Ты помогаешь создавать system prompt для консультанта курса «Тело не врёт» (школа мышечного тестирования). Ответь только текстом самого промпта, без пояснений и кавычек.';

  const startMs = Date.now();
  const llmResult = await completeLlmChat({
    provider,
    apiKey,
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: instruction },
    ],
    maxTokens: 1024,
    temperature: 0.5,
  });

  if (!llmResult.ok) {
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ, провайдера и модель в Настройках AI.' },
      { status: 502 }
    );
  }

  const content = llmResult.content;

  logLlmRequest({
    source: 'prompt-generate',
    model,
    promptChars: sys.length + instruction.length,
    responseChars: content.length,
    durationMs: Date.now() - startMs,
    userId: auth?.userId,
    role: 'admin',
  });

  return NextResponse.json({ content });
}
