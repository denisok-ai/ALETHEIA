/**
 * AI tutor for SCORM course: streaming chat grounded in course content (Course.aiContext).
 * Saves conversations to AiTutorConversation/AiTutorMessage for admin review.
 * POST body: { messages: UIMessage[], courseId: string, lessonId?: string, conversationId?: string }
 */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLlmApiKey } from '@/lib/llm';
import { applyCourseTutorPlaceholders } from '@/lib/ai-placeholders';
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { streamText, convertToModelMessages } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const DEFAULT_MODEL = 'deepseek-chat';

function getMessageContent(m: { content?: string; text?: string }): string {
  return String((m as { content?: string }).content ?? (m as { text?: string }).text ?? '').trim();
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { messages?: unknown[]; courseId?: string; lessonId?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { messages = [], courseId, lessonId, conversationId: existingConvId } = body;
  if (!courseId || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Missing courseId or messages' }), { status: 400 });
  }

  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin' && role !== 'manager') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      return new Response(JSON.stringify({ error: 'Not enrolled' }), { status: 403 });
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, aiContext: true, aiTutorEnabled: true },
  });
  if (!course) {
    return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404 });
  }
  if (course.aiTutorEnabled === false) {
    return new Response(
      JSON.stringify({ error: 'AI-тьютор отключён для этого курса.' }),
      { status: 403 }
    );
  }

  let conversationId = existingConvId as string | undefined;
  if (conversationId) {
    const conv = await prisma.aiTutorConversation.findFirst({
      where: { id: conversationId, userId, courseId },
    });
    if (!conv) conversationId = undefined;
  }

  if (!conversationId) {
    const conv = await prisma.aiTutorConversation.create({
      data: { userId, courseId, lessonId: lessonId ?? null },
    });
    conversationId = conv.id;
  }

  const lastUserMsg = [...messages].reverse().find((m) => (m as { role?: string }).role === 'user');
  if (lastUserMsg && getMessageContent(lastUserMsg as { content?: string; text?: string })) {
    await prisma.aiTutorMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: getMessageContent(lastUserMsg as { content?: string; text?: string }),
      },
    });
  }

  const progressList = await prisma.scormProgress.findMany({
    where: { userId, courseId },
    select: { lessonId: true, completionStatus: true },
  });
  const completedLessons = progressList.filter(
    (p) => p.completionStatus === 'completed' || p.completionStatus === 'passed'
  ).length;
  let totalLessons = 1;
  if (course.aiContext) {
    try {
      const parsed = JSON.parse(course.aiContext) as unknown[];
      totalLessons = Array.isArray(parsed) ? parsed.length : 1;
    } catch {
      // ignore
    }
  }

  const courseContent = course.aiContext ?? 'Контент курса не извлечён (загрузите SCORM ZIP).';
  let contentText = courseContent;
  if (courseContent.startsWith('[')) {
    try {
      const arr = JSON.parse(courseContent) as { lessonId: string; title?: string; content: string }[];
      contentText = Array.isArray(arr)
        ? arr.map((l) => `## ${l.title ?? l.lessonId}\n${l.content}`).join('\n\n')
        : courseContent;
    } catch {
      // use raw
    }
  }

  const currentLessonTitle = lessonId ?? 'текущий урок';

  const systemSettings = await getSystemSettings();
  const siteBase = normalizeSiteUrl(
    systemSettings.site_url || process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro'
  ).replace(/\/$/, '');
  const courseUrl = absoluteCourseCheckoutUrl(siteBase);
  const supportEmail =
    (systemSettings.resend_notify_email || 'info@avaterra.pro').trim() || 'info@avaterra.pro';

  const tutorLlmRow = await prisma.llmSetting.findUnique({
    where: { key: 'course-tutor' },
  });
  const activeTutorTemplate = await prisma.promptTemplate.findFirst({
    where: { scope: 'course-tutor', isActive: true },
  });
  /** Активный шаблон «course-tutor» имеет приоритет над полем playbook в настройках LLM. */
  const playbookRaw =
    activeTutorTemplate?.content?.trim() ?? tutorLlmRow?.systemPrompt?.trim() ?? '';
  const tutorTemplateIdForStats = playbookRaw && activeTutorTemplate?.content?.trim()
    ? activeTutorTemplate.id
    : null;

  let playbookPrefix = '';
  if (playbookRaw) {
    playbookPrefix =
      applyCourseTutorPlaceholders(playbookRaw, {
        siteBase,
        courseUrl,
        supportEmail,
        courseId,
      }) + '\n\n---\n\n';
  }

  const systemPrompt = `${playbookPrefix}Ты AI-тьютор курса «${course.title}».
Отвечай ТОЛЬКО на основе содержимого курса ниже.
Текущий урок студента: ${currentLessonTitle}.
Прогресс студента: ${completedLessons}/${totalLessons} уроков.
Если ответа нет в материалах — скажи об этом и предложи обратиться к куратору.
Не выдумывай факты.

---
${contentText}`;

  const apiKey = await getLlmApiKey('course-tutor') || await getLlmApiKey('chatbot');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Сервис тьютора временно недоступен. Настройте API-ключ в Настройки AI.' }),
      { status: 503 }
    );
  }

  const fallback = await prisma.llmSetting.findUnique({
    where: { key: 'chatbot' },
  });
  const s = tutorLlmRow ?? fallback;
  const modelId = s?.model ?? DEFAULT_MODEL;
  const temperature = Number(s?.temperature) ?? 0.5;
  const maxTokens = Number(s?.maxTokens) ?? 1024;

  const deepseek = createDeepSeek({ apiKey });
  const model = deepseek(modelId as 'deepseek-chat');

  const modelMessages = await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    maxOutputTokens: maxTokens,
    temperature,
    onFinish: async ({ text }) => {
      if (text?.trim()) {
        try {
          await prisma.aiTutorMessage.create({
            data: { conversationId: conversationId!, role: 'assistant', content: text },
          });
        } catch (e) {
          console.error('Failed to save AI tutor message:', e);
        }
        if (tutorTemplateIdForStats) {
          await prisma.promptTemplate
            .update({
              where: { id: tutorTemplateIdForStats },
              data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
            })
            .catch(() => {});
        }
      }
    },
  });

  const response = await result.toUIMessageStreamResponse();
  const headers = new Headers(response.headers);
  headers.set('X-Conversation-Id', conversationId);
  return new Response(response.body, { status: response.status, headers });
}
