import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getKnowledgeBase, getSystemSettings } from '@/lib/settings';
import { getLlmApiKey } from '@/lib/llm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logLlmRequest } from '@/lib/llm-request-log';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { normalizeSiteUrl } from '@/lib/site-url';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
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
    /** Плейсхолдер {{COURSE_URL}} в базе знаний — тот же URL, что кнопки «Купить курс» / CTA. */
    const courseUrl = absoluteCourseCheckoutUrl(siteBase);

    const knowledgeBase = await getKnowledgeBase();
    if (!knowledgeBase.trim()) {
      return NextResponse.json(
        { error: 'База знаний не настроена. Добавьте контент в Настройки AI.' },
        { status: 500 }
      );
    }

    const systemContent = knowledgeBase.replace(/\{\{COURSE_URL\}\}/g, courseUrl);

    let systemPrompt = 'Ты консультант курса «Тело не врёт». Отвечай ТОЛЬКО на основе приведённой ниже базы знаний. Строго следуй правилам из базы: медицинский дисклеймер при ответах про здоровье/психику; при отсутствии информации — не выдумывай, предложи уточнить у кураторов; своди к мышечному тесту и базовому курсу; в конце давай ссылку на курс.\n\n---\n\n';
    let model = DEFAULT_MODEL;
    let temperature = 0.5;
    let maxTokens = 1024;
    let activeTemplateId: string | null = null;

    const chatbotLlmSetting = await prisma.llmSetting.findUnique({
      where: { key: 'chatbot' },
    });
    if (chatbotLlmSetting) {
      model = chatbotLlmSetting.model ?? DEFAULT_MODEL;
      temperature = Number(chatbotLlmSetting.temperature) || 0.5;
      maxTokens = Number(chatbotLlmSetting.maxTokens) || 1024;
      if (chatbotLlmSetting.systemPrompt?.trim()) {
        systemPrompt = chatbotLlmSetting.systemPrompt.trim() + '\n\n---\n\n';
      }
    }

    const activeTemplate = await prisma.promptTemplate.findFirst({
      where: { scope: 'chatbot', isActive: true },
    });
    if (activeTemplate?.content?.trim()) {
      systemPrompt = activeTemplate.content.trim() + '\n\n---\n\n';
      activeTemplateId = activeTemplate.id;
    }

    const fullSystemContent = systemPrompt + systemContent;
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
          { role: 'system', content: fullSystemContent },
          { role: 'user', content: message },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return NextResponse.json(
        { error: 'Сервис ответов временно недоступен. Попробуйте позже.' },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
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
        model,
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
