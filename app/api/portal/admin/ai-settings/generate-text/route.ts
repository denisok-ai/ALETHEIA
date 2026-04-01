/**
 * Admin: generic text generation for drafts (tickets, templates, mailings, etc.).
 * Uses LlmSetting "chatbot". Body: { instruction, context?, systemPrompt?, maxTokens? }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getLlmApiKey } from '@/lib/llm';
import { prisma } from '@/lib/db';
import { logLlmRequest } from '@/lib/llm-request-log';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const DEFAULT_SYSTEM = 'Ты помощник для контента школы AVATERRA. Отвечай только запрошенным текстом, без пояснений и кавычек вокруг ответа.';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { instruction?: string; context?: string; systemPrompt?: string; maxTokens?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  if (!instruction) {
    return NextResponse.json({ error: 'Укажите instruction для генерации' }, { status: 400 });
  }

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return NextResponse.json({ error: 'Настройте API-ключ в блоке «Ключи моделей»' }, { status: 503 });
  }

  const settings = await prisma.llmSetting.findUnique({ where: { key: 'chatbot' } });
  const model = settings?.model ?? 'deepseek-chat';
  const system = typeof body.systemPrompt === 'string' && body.systemPrompt.trim()
    ? body.systemPrompt.trim()
    : DEFAULT_SYSTEM;
  const maxTokens = typeof body.maxTokens === 'number' && body.maxTokens > 0
    ? Math.min(body.maxTokens, 4096)
    : 1024;

  const userContent = typeof body.context === 'string' && body.context.trim()
    ? `${body.context}\n\n---\n${instruction}`
    : instruction;

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
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ и модель.' },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

  logLlmRequest({
    source: 'generate-text',
    model,
    promptChars: system.length + userContent.length,
    responseChars: content.length,
    durationMs: Date.now() - startMs,
    userId: auth.userId,
    role: auth.role,
  });

  return NextResponse.json({ content });
}
