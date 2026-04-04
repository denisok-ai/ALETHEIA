/**
 * Автоответ при создании тикета: вызов LLM по теме и первому сообщению, проверка «уверенности» ответа.
 * Используется в POST /api/portal/tickets при включённой настройке ticket_auto_reply_enabled.
 */
import { applyPublicChatPlaceholders } from '@/lib/ai-placeholders';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { getLlmApiKey } from '@/lib/llm';
import { completeLlmChat, resolveChatbotProvider } from '@/lib/llm-chat-completion';
import { getEnvOverrides, getKnowledgeBase, getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';
import { logLlmRequest } from '@/lib/llm-request-log';
const KB_MAX_CHARS = 6000;
const MAX_REPLY_LENGTH = 800;

/** Фразы, при наличии которых ответ считаем «неуверенным» и не сохраняем как автоответ. */
const DISCLAIMER_PATTERNS = [
  /не\s+уверен/i,
  /не\s+могу\s+ответить/i,
  /обратитесь\s+к\s+(менеджеру|поддержке|администратору)/i,
  /уточните\s+у\s+(менеджера|поддержки)/i,
  /требуется\s+уточнение/i,
  /напишите\s+(в\s+)?поддержку/i,
  /свяжитесь\s+с\s+поддержкой/i,
  /я\s+не\s+имею\s+доступа/i,
  /не\s+располагаю\s+информацией/i,
];

export function isConfidentReply(reply: string): boolean {
  const t = reply.trim();
  if (t.length > MAX_REPLY_LENGTH) return false;
  if (t.length < 10) return false;
  return !DISCLAIMER_PATTERNS.some((re) => re.test(t));
}

/**
 * Генерирует краткий ответ поддержки по теме и первому сообщению клиента.
 * Возвращает текст ответа или null при ошибке/отсутствии ключа.
 */
export async function generateAutoReply(subject: string, firstMessage: string): Promise<string | null> {
  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) return null;

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
      const raw = kb.trim().length > KB_MAX_CHARS ? kb.trim().slice(0, KB_MAX_CHARS) + '\n\n[...]' : kb.trim();
      knowledgeSnippet = applyPublicChatPlaceholders(raw, { siteBase, courseUrl, supportEmail });
    }
  } catch {
    // ignore
  }

  const sysParts = [
    'Ты помощник поддержки школы AVATERRA. Ответь клиенту кратко и по делу, только текстом ответа, без кавычек и пояснений. Если не можешь дать однозначный ответ — напиши коротко, что нужно уточнить у менеджера.',
  ];
  if (knowledgeSnippet) {
    sysParts.push('');
    sysParts.push('Типовые ответы и правила (используй при уместности):');
    sysParts.push('---');
    sysParts.push(knowledgeSnippet);
    sysParts.push('---');
  }
  const sys = sysParts.join('\n');
  const userContent = `Тема обращения: ${subject}\n\nСообщение клиента:\n${firstMessage}\n\n---\nДай краткий ответ от имени поддержки.`;

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

  try {
    const result = await completeLlmChat({
      provider,
      apiKey,
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userContent },
      ],
      maxTokens: 400,
      temperature: 0.4,
    });

    if (!result.ok) return null;
    const content = result.content;
    logLlmRequest({
      source: 'ticket-auto-reply',
      model,
      promptChars: sys.length + userContent.length,
      responseChars: content.length,
      durationMs: Date.now() - startMs,
    });
    return content || null;
  } catch {
    return null;
  }
}
