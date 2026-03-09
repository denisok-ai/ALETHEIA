import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@/lib/supabase/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Чат временно недоступен. Обратитесь к администратору.' },
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

    const courseUrl =
      process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') + '/#pricing' ||
      '/#pricing';

    let knowledgeBase: string;
    try {
      const filePath = path.join(
        process.cwd(),
        'content',
        'knowledge-base-body-never-lies.md'
      );
      knowledgeBase = await readFile(filePath, 'utf-8');
    } catch (e) {
      console.error('Knowledge base read error:', e);
      return NextResponse.json(
        { error: 'База знаний недоступна. Попробуйте позже.' },
        { status: 500 }
      );
    }

    const systemContent = knowledgeBase.replace(/\{\{COURSE_URL\}\}/g, courseUrl);

    let systemPrompt = 'Ты консультант курса «Тело не врёт». Отвечай ТОЛЬКО на основе приведённой ниже базы знаний. Строго следуй правилам из базы: медицинский дисклеймер при ответах про здоровье/психику; при отсутствии информации — не выдумывай, предложи уточнить у кураторов; своди к мышечному тесту и базовому курсу; в конце давай ссылку на курс.\n\n---\n\n';
    let model = DEFAULT_MODEL;
    let temperature = 0.5;
    let maxTokens = 1024;

    const supabase = createClient();
    if (supabase) {
      const { data: settings } = await supabase
        .from('llm_settings')
        .select('model, system_prompt, temperature, max_tokens')
        .eq('key', 'chatbot')
        .maybeSingle();
      if (settings) {
        model = (settings as { model?: string }).model ?? DEFAULT_MODEL;
        temperature = Number((settings as { temperature?: number }).temperature) || 0.5;
        maxTokens = Number((settings as { max_tokens?: number }).max_tokens) || 1024;
        const customPrompt = (settings as { system_prompt?: string | null }).system_prompt;
        if (customPrompt?.trim()) {
          systemPrompt = customPrompt.trim() + '\n\n---\n\n';
        }
      }
    }

    const fullSystemContent = systemPrompt + systemContent;

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

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Произошла ошибка. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
