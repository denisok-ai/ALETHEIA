/**
 * POST: AI-suggested reply for ticket (manager or admin). Uses LlmSetting "chatbot".
 * Injects knowledge base (Настройки AI → База знаний) into context for RAG-style typical answers.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { applyPublicChatPlaceholders } from '@/lib/ai-placeholders';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { getLlmApiKey } from '@/lib/llm';
import { completeLlmChat, resolveChatbotProvider } from '@/lib/llm-chat-completion';
import { getEnvOverrides, getKnowledgeBase, getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { logLlmRequest } from '@/lib/llm-request-log';
const KB_MAX_CHARS = 6000;

function parseMessages(raw: string): { role: string; content: string; at: string }[] {
  try {
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr)
      ? arr.filter(
          (m): m is { role: string; content: string; at: string } =>
            typeof m === 'object' && m !== null && typeof (m as { content?: string }).content === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== 'manager' && role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true, messages: true },
  });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Настройте API-ключ в Настройки AI → Ключи моделей' },
      { status: 503 }
    );
  }

  const messages = parseMessages(ticket.messages);
  const contextLines = [
    `Тема: ${ticket.subject}`,
    '',
    'Переписка:',
    ...messages.map((m) => `[${m.role}]: ${m.content}`),
  ];
  const context = contextLines.join('\n');

  const systemSettings = await getSystemSettings();
  const siteBase = normalizeSiteUrl(
    systemSettings.site_url || process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro'
  ).replace(/\/$/, '');
  const courseUrl = absoluteCourseCheckoutUrl(siteBase);
  const supportEmail =
    (systemSettings.resend_notify_email || 'info@avaterra.pro').trim() || 'info@avaterra.pro';

  let knowledgeSnippet = '';
  try {
    const kb = await getKnowledgeBase();
    if (kb.trim()) {
      const raw = kb.trim().length > KB_MAX_CHARS
        ? kb.trim().slice(0, KB_MAX_CHARS) + '\n\n[...]'
        : kb.trim();
      knowledgeSnippet = applyPublicChatPlaceholders(raw, { siteBase, courseUrl, supportEmail });
    }
  } catch {
    // ignore
  }

  const sysParts = [
    'Ты помощник поддержки школы AVATERRA. Предложи краткий вежливый ответ клиенту по переписке. Ответь только текстом ответа, без кавычек и пояснений.',
  ];
  if (knowledgeSnippet) {
    sysParts.push('');
    sysParts.push('Типовые ответы и правила (используй при уместности):');
    sysParts.push('---');
    sysParts.push(knowledgeSnippet);
    sysParts.push('---');
  }
  const sys = sysParts.join('\n');
  const userContent = `${context}\n\n---\nПредложи краткий ответ клиенту от имени поддержки.`;

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
  const startMs = Date.now();

  const llmResult = await completeLlmChat({
    provider,
    apiKey,
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userContent },
    ],
    maxTokens: 512,
    temperature: 0.5,
  });

  if (!llmResult.ok) {
    console.error('suggest-reply LLM error:', provider, model, llmResult.status, llmResult.bodySnippet);
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ и провайдера в Настройках AI.' },
      { status: 502 }
    );
  }

  const content = llmResult.content;

  logLlmRequest({
    source: 'suggest-reply',
    model,
    promptChars: sys.length + userContent.length,
    responseChars: content.length,
    durationMs: Date.now() - startMs,
    userId: session?.user && typeof session.user === 'object' && 'id' in session.user ? (session.user as { id: string }).id : undefined,
    role: session?.user && typeof session.user === 'object' && 'role' in session.user ? (session.user as { role?: string }).role : undefined,
  });

  return NextResponse.json({ content });
}
