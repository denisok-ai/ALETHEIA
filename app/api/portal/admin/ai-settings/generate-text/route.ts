/**
 * Admin: generic text generation for drafts (tickets, templates, mailings, etc.).
 * Uses LlmSetting "chatbot". Body: { instruction, context?, systemPrompt?, maxTokens? }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getLlmApiKey } from '@/lib/llm';
import { completeLlmChat, resolveChatbotProvider } from '@/lib/llm-chat-completion';
import { getEnvOverrides } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { logLlmRequest } from '@/lib/llm-request-log';

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
  const llmResult = await completeLlmChat({
    provider,
    apiKey,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    maxTokens,
    temperature: 0.5,
  });

  if (!llmResult.ok) {
    console.error('generate-text LLM error:', provider, model, llmResult.status, llmResult.bodySnippet);
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ, провайдера и модель в Настройках AI.' },
      { status: 502 }
    );
  }

  const content = llmResult.content;

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
