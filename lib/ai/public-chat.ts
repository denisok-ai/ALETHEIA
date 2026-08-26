/**
 * Ядро публичного AI-консультанта: ответ по базе знаний школы с защитой.
 *
 * Вынесено из app/api/chat/route.ts, чтобы одну и ту же проверенную логику
 * (guard входа → база знаний + живая витрина → LLM → сверка ответа с витриной)
 * могли использовать и веб-чат, и Telegram-бот. Никаких выдумок: модель
 * отвечает только по базе, с медицинским дисклеймером, а расхождения с
 * витриной уходят админам.
 *
 * Функция НЕ занимается rate-limit и авторизацией — это забота вызывающего
 * (веб-роут лимитирует по IP, бот — своим антифлудом).
 */
import { prisma } from '@/lib/db';
import { getEnvOverrides, getKnowledgeBase, getSystemSettings } from '@/lib/settings';
import { getLlmApiKey } from '@/lib/llm';
import {
  completeLlmChat,
  parseLlmErrorHint,
  resolveChatbotProvider,
  resolveEffectiveChatModel,
  DEFAULT_ANTHROPIC_MODEL,
} from '@/lib/llm-chat-completion';
import {
  UNTRUSTED_DATA_POLICY,
  sanitizeChatHistory,
  wrapUntrusted,
} from '@/lib/llm-guard';
import { buildLiveCatalogBlock, getCachedPublicProducts } from '@/lib/ai/live-catalog';
import { auditAnswerAgainstCatalog, describeFindings, shouldAlert } from '@/lib/ai/answer-audit';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { applyPublicChatPlaceholders } from '@/lib/ai-placeholders';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { normalizeSiteUrl } from '@/lib/site-url';

const DEFAULT_MODEL = 'deepseek-chat';

export type PublicChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export type PublicChatResult =
  | { ok: true; answer: string; model: string; promptChars: number; durationMs: number }
  | { ok: false; error: string; status: number };

/**
 * Ответить на вопрос посетителя по базе знаний.
 * `surface` — откуда вопрос (для логов и метки в аудите).
 */
export async function answerPublicQuestion(params: {
  message: string;
  history?: unknown;
  surface: 'web-chat' | 'telegram-bot';
}): Promise<PublicChatResult> {
  const message = params.message.trim();
  if (!message) return { ok: false, error: 'Напишите ваш вопрос.', status: 400 };

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    return { ok: false, error: 'Чат временно недоступен.', status: 503 };
  }

  const history = sanitizeChatHistory(params.history);

  const systemSettings = await getSystemSettings();
  const siteBase = normalizeSiteUrl(
    systemSettings.site_url || process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro'
  ).replace(/\/$/, '');
  const courseUrl = absoluteCourseCheckoutUrl(siteBase);
  const supportEmail =
    (systemSettings.resend_notify_email || 'support@avaterra.pro').trim() || 'support@avaterra.pro';

  const knowledgeBase = await getKnowledgeBase();
  if (!knowledgeBase.trim()) {
    return { ok: false, error: 'База знаний не настроена.', status: 500 };
  }

  let systemPrompt =
    'Ты консультант курса «Тело не врёт». Отвечай ТОЛЬКО на основе приведённой ниже базы знаний. Строго следуй правилам из базы: медицинский дисклеймер при ответах про здоровье/психику; при отсутствии информации — не выдумывай, предложи уточнить у кураторов; своди к мышечному тесту и базовому курсу; в конце давай ссылку на курс.\n\n---\n\n';
  let model = DEFAULT_MODEL;
  let temperature = 0.5;
  let maxTokens = 1024;

  const chatbotLlmSetting = await prisma.llmSetting.findUnique({
    where: { key: 'chatbot' },
    include: { apiKey: { select: { provider: true } } },
  });
  const envOverrides = await getEnvOverrides();
  const provider = resolveChatbotProvider(chatbotLlmSetting, envOverrides);
  if (chatbotLlmSetting) {
    model = chatbotLlmSetting.model ?? DEFAULT_MODEL;
    temperature = Number(chatbotLlmSetting.temperature) || 0.5;
    maxTokens = Number(chatbotLlmSetting.maxTokens) || 1024;
    if (chatbotLlmSetting.systemPrompt?.trim()) {
      systemPrompt = chatbotLlmSetting.systemPrompt.trim() + '\n\n---\n\n';
    }
  } else if (provider === 'openai') {
    model = 'gpt-4o-mini';
  } else if (provider === 'anthropic') {
    model = DEFAULT_ANTHROPIC_MODEL;
  }

  const activeTemplate = await prisma.promptTemplate.findFirst({
    where: { scope: 'chatbot', isActive: true },
  });
  let activeTemplateId: string | null = null;
  if (activeTemplate?.content?.trim()) {
    systemPrompt = activeTemplate.content.trim() + '\n\n---\n\n';
    activeTemplateId = activeTemplate.id;
  }

  const liveCatalog = await buildLiveCatalogBlock(siteBase);
  const fullSystemContent = applyPublicChatPlaceholders(
    systemPrompt + knowledgeBase + (liveCatalog ? `\n\n---\n\n${liveCatalog}` : ''),
    { siteBase, courseUrl, supportEmail }
  );
  const startMs = Date.now();
  const effectiveModel = resolveEffectiveChatModel(provider, model);

  const llmResult = await completeLlmChat({
    provider,
    apiKey,
    model,
    messages: [
      { role: 'system', content: `${fullSystemContent}\n\n${UNTRUSTED_DATA_POLICY}` },
      ...history.map((m) => ({
        role: m.role,
        content: m.role === 'user' ? wrapUntrusted(m.content, 'предыдущий вопрос посетителя') : m.content,
      })),
      { role: 'user', content: wrapUntrusted(message, 'вопрос посетителя') },
    ],
    maxTokens,
    temperature,
  });

  if (!llmResult.ok) {
    const apiHint = parseLlmErrorHint(llmResult.status, llmResult.bodySnippet);
    console.error('[public-chat] LLM error:', params.surface, provider, llmResult.status, apiHint ?? '');
    return { ok: false, error: 'Чат временно недоступен.', status: 502 };
  }

  const answer = llmResult.content || 'Не удалось получить ответ. Попробуйте переформулировать вопрос.';

  // Сверка с витриной: ответ не правим, но о расхождении сообщаем админам.
  try {
    const findings = auditAnswerAgainstCatalog(answer, await getCachedPublicProducts());
    if (findings.length) {
      const detail = describeFindings(findings);
      console.warn('[answer-audit] расхождение с витриной:', detail, '| вопрос:', message.slice(0, 120));
      if (shouldAlert(findings)) {
        await notifyAdminsTelegram('contact_lead', [
          `Бот (${params.surface}) назвал данные, которых нет в витрине:`,
          detail,
          `Вопрос: ${message.slice(0, 200)}`,
          'Проверьте базу знаний в Портал → Настройки AI.',
        ]);
      }
    }
  } catch (e) {
    console.error('[answer-audit] сбой проверки:', e);
  }

  if (activeTemplateId) {
    await prisma.promptTemplate
      .update({ where: { id: activeTemplateId }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return {
    ok: true,
    answer,
    model: effectiveModel,
    promptChars: fullSystemContent.length + message.length,
    durationMs: Date.now() - startMs,
  };
}
