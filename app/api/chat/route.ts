import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logSuspiciousLlmInput, sanitizeLlmInput } from '@/lib/llm-guard';
import { answerPublicQuestion } from '@/lib/ai/public-chat';
import { logLlmRequest } from '@/lib/llm-request-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  // Гости (без входа) могут использовать чат — ограничение по rate limit
  const rateLimitRes = checkRateLimit(request, 'chat', session?.user ? 10 : 5);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    // Guard: лимит длины (вытеснение контекста и денежное истощение), чистка control-символов
    const guarded = sanitizeLlmInput(body?.message, 'chat');
    if (guarded.suspicious) {
      logSuspiciousLlmInput({
        surface: 'public-chat',
        actor: (session?.user as { id?: string } | undefined)?.id ?? null,
        snippet: guarded.text,
      });
    }
    const message = guarded.text;
    if (!message) {
      return NextResponse.json({ error: 'Напишите ваш вопрос.' }, { status: 400 });
    }

    const result = await answerPublicQuestion({
      message,
      history: body?.history,
      surface: 'web-chat',
    });

    if (!result.ok) {
      // Публичный эндпоинт: не показываем внутреннюю конфигурацию, только мягкий текст.
      const clientError =
        result.status >= 500
          ? 'Чат временно недоступен. Напишите нам на почту или через страницу контактов — обязательно поможем.'
          : result.error;
      return NextResponse.json({ error: clientError }, { status: result.status });
    }

    if (session?.user) {
      logLlmRequest({
        source: 'chatbot',
        model: result.model,
        promptChars: result.promptChars,
        responseChars: result.answer.length,
        durationMs: result.durationMs,
        userId: (session.user as { id?: string })?.id,
        role: (session.user as { role?: string })?.role,
      });
    }

    return NextResponse.json({ answer: result.answer });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Произошла ошибка. Попробуйте позже.' }, { status: 500 });
  }
}
