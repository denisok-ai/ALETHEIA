import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEnvOverrides, getKnowledgeBase, getSystemSettings } from '@/lib/settings';
import { getLlmApiKey } from '@/lib/llm';
import {
  completeLlmChat,
  parseLlmErrorHint,
  resolveChatbotProvider,
  resolveEffectiveChatModel,
} from '@/lib/llm-chat-completion';
import { checkRateLimit } from '@/lib/rate-limit';
import { logLlmRequest } from '@/lib/llm-request-log';
import { applyPublicChatPlaceholders } from '@/lib/ai-placeholders';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { normalizeSiteUrl } from '@/lib/site-url';

const DEFAULT_MODEL = 'deepseek-chat';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  // Гости (без входа) могут использовать чат — ограничение по rate limit
  const rateLimitRes = checkRateLimit(request, 'chat', session?.user ? 10 : 5);
  if (rateLimitRes) return rateLimitRes;

  try {
    const apiKey = await getLlmApiKey('chatbot');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Чат временно недоступен. Настройте API-ключ в Настройки AI.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json(
        { error: 'Напишите ваш вопрос.' },
        { status: 400 }
      );
    }

    const systemSettings = await getSystemSettings();
    const siteBase = normalizeSiteUrl(systemSettings.site_url || process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro').replace(
      /\/$/,
      ''
    );
    /** {{COURSE_URL}} — URL оформления курса (как CTA на лендинге). */
    const courseUrl = absoluteCourseCheckoutUrl(siteBase);
    const supportEmail =
      (systemSettings.resend_notify_email || 'info@avaterra.pro').trim() || 'info@avaterra.pro';

    const knowledgeBase = await getKnowledgeBase();
    if (!knowledgeBase.trim()) {
      return NextResponse.json(
        { error: 'База знаний не настроена. Добавьте контент в Настройки AI.' },
        { status: 500 }
      );
    }

    let systemPrompt = 'Ты консультант курса «Тело не врёт». Отвечай ТОЛЬКО на основе приведённой ниже базы знаний. Строго следуй правилам из базы: медицинский дисклеймер при ответах про здоровье/психику; при отсутствии информации — не выдумывай, предложи уточнить у кураторов; своди к мышечному тесту и базовому курсу; в конце давай ссылку на курс.\n\n---\n\n';
    let model = DEFAULT_MODEL;
    let temperature = 0.5;
    let maxTokens = 1024;
    let activeTemplateId: string | null = null;

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
    } else {
      if (provider === 'openai') model = 'gpt-4o-mini';
      else if (provider === 'anthropic') model = 'claude-3-5-haiku-20240307';
    }

    const activeTemplate = await prisma.promptTemplate.findFirst({
      where: { scope: 'chatbot', isActive: true },
    });
    if (activeTemplate?.content?.trim()) {
      systemPrompt = activeTemplate.content.trim() + '\n\n---\n\n';
      activeTemplateId = activeTemplate.id;
    }

    const fullSystemContent = applyPublicChatPlaceholders(systemPrompt + knowledgeBase, {
      siteBase,
      courseUrl,
      supportEmail,
    });
    const startMs = Date.now();
    const effectiveModel = resolveEffectiveChatModel(provider, model);

    const llmResult = await completeLlmChat({
      provider,
      apiKey,
      model,
      messages: [
        { role: 'system', content: fullSystemContent },
        { role: 'user', content: message },
      ],
      maxTokens,
      temperature,
    });

    if (!llmResult.ok) {
      console.error(
        'LLM chat API error:',
        provider,
        '(configured model:',
        model,
        '→',
        effectiveModel,
        ')',
        llmResult.status,
        llmResult.bodySnippet
      );
      const apiHint = parseLlmErrorHint(llmResult.status, llmResult.bodySnippet);
      let error =
        'Сервис ответов временно недоступен. Проверьте ключ и что для чат-бота выбран ключ того же провайдера (DeepSeek / OpenAI / Anthropic), что и в списке «Ключи моделей».';
      if (llmResult.status === 401 || llmResult.status === 403) {
        error =
          'Провайдер не принял API-ключ (ошибка авторизации). Частая причина: выбран ключ OpenAI, а в настройках чат-бота указан провайдер DeepSeek — выберите в списке ключей тот, который соответствует вашему ключу, или вставьте верный ключ DeepSeek.';
      }
      if (apiHint) {
        error = `${error} Детали: ${apiHint}`;
      }
      return NextResponse.json({ error }, { status: 502 });
    }

    const answer =
      llmResult.content ||
      'Не удалось получить ответ. Попробуйте переформулировать вопрос.';

    if (activeTemplateId) {
      await prisma.promptTemplate.update({
        where: { id: activeTemplateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      }).catch(() => {});
    }

    if (session?.user) {
      logLlmRequest({
        source: 'chatbot',
        model: effectiveModel,
        promptChars: fullSystemContent.length + message.length,
        responseChars: answer.length,
        durationMs: Date.now() - startMs,
        userId: (session.user as { id?: string })?.id,
        role: (session.user as { role?: string })?.role,
      });
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Произошла ошибка. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
