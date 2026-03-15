/**
 * AI tutor for SCORM course: streaming chat grounded in course content (Course.aiContext).
 * POST body: { messages: UIMessage[], courseId: string, lessonId?: string }
 * Auth: enrolled student only. Uses LlmSetting key 'course-tutor' or falls back to 'chatbot'.
 */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLlmApiKey } from '@/lib/llm';
import { streamText, convertToModelMessages } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const DEFAULT_MODEL = 'deepseek-chat';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { messages?: unknown[]; courseId?: string; lessonId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { messages = [], courseId, lessonId } = body;
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
  const systemPrompt = `Ты AI-тьютор курса «${course.title}».
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

  const settings = await prisma.llmSetting.findUnique({
    where: { key: 'course-tutor' },
  });
  const fallback = await prisma.llmSetting.findUnique({
    where: { key: 'chatbot' },
  });
  const s = settings ?? fallback;
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
  });

  return result.toUIMessageStreamResponse();
}
