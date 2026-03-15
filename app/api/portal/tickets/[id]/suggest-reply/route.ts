/**
 * POST: AI-suggested reply for ticket (manager or admin). Uses LlmSetting "chatbot".
 * Injects knowledge base (Настройки AI → База знаний) into context for RAG-style typical answers.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLlmApiKey } from '@/lib/llm';
import { getKnowledgeBase } from '@/lib/settings';
import { logLlmRequest } from '@/lib/llm-request-log';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
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

  let knowledgeSnippet = '';
  try {
    const kb = await getKnowledgeBase();
    if (kb.trim()) {
      knowledgeSnippet = kb.trim().length > KB_MAX_CHARS
        ? kb.trim().slice(0, KB_MAX_CHARS) + '\n\n[...]'
        : kb.trim();
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

  const settings = await prisma.llmSetting.findUnique({ where: { key: 'chatbot' } });
  const model = settings?.model ?? 'deepseek-chat';
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
        { role: 'system', content: sys },
        { role: 'user', content: userContent },
      ],
      max_tokens: 512,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Ошибка вызова модели. Проверьте ключ в Настройках AI.' },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

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
