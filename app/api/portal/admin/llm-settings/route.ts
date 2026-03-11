/**
 * Admin: get/update LLM settings (chatbot, course-tutor). API key stored encrypted in DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || 'chatbot';

  const row = await prisma.llmSetting.findUnique({
    where: { key },
    include: { apiKey: { select: { id: true, name: true, provider: true } } },
  });
  if (!row) {
    return NextResponse.json({
      key,
      provider: 'deepseek',
      model: 'deepseek-chat',
      system_prompt: null,
      temperature: 0.7,
      max_tokens: 2000,
      api_key_set: false,
      api_key_id: null,
    });
  }

  const apiKeySet = Boolean(row.apiKeyEncrypted) || Boolean(row.apiKeyId && row.apiKey);
  return NextResponse.json({
    id: row.id,
    key: row.key,
    provider: row.provider,
    model: row.model,
    system_prompt: row.systemPrompt ?? null,
    temperature: row.temperature ?? 0.7,
    max_tokens: row.maxTokens ?? 2000,
    api_key_set: apiKeySet,
    api_key_id: row.apiKeyId ?? null,
    api_key_ref: row.apiKey ? { id: row.apiKey.id, name: row.apiKey.name, provider: row.apiKey.provider } : null,
  });
}

type Body = {
  key: string;
  provider?: string;
  model?: string;
  system_prompt?: string | null;
  temperature?: number;
  max_tokens?: number;
  api_key?: string | null;
  api_key_id?: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key : 'chatbot';
  const update: {
    provider?: string;
    model?: string;
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    apiKeyEncrypted?: string | null;
    apiKeyId?: string | null;
  } = {};

  if (typeof body.provider === 'string') update.provider = body.provider;
  if (typeof body.model === 'string') update.model = body.model;
  if (body.system_prompt !== undefined) update.systemPrompt = body.system_prompt ?? null;
  if (typeof body.temperature === 'number') update.temperature = body.temperature;
  if (typeof body.max_tokens === 'number') update.maxTokens = body.max_tokens;
  if (body.api_key_id !== undefined) {
    update.apiKeyId = body.api_key_id === null || body.api_key_id === '' ? null : body.api_key_id;
    if (update.apiKeyId) update.apiKeyEncrypted = null;
  }

  if (body.api_key !== undefined) {
    if (body.api_key === null || body.api_key === '') {
      update.apiKeyEncrypted = null;
      if (body.api_key_id === undefined) update.apiKeyId = null;
    } else {
      try {
        update.apiKeyEncrypted = encrypt(String(body.api_key).trim());
        update.apiKeyId = null;
      } catch (e) {
        return NextResponse.json({ error: 'Ошибка шифрования ключа. Проверьте NEXTAUTH_SECRET.' }, { status: 500 });
      }
    }
  }

  await prisma.llmSetting.upsert({
    where: { key },
    create: {
      key,
      provider: update.provider ?? 'deepseek',
      model: update.model ?? 'deepseek-chat',
      systemPrompt: update.systemPrompt ?? null,
      temperature: update.temperature ?? 0.7,
      maxTokens: update.maxTokens ?? 2000,
      apiKeyEncrypted: update.apiKeyEncrypted ?? null,
      apiKeyId: update.apiKeyId ?? null,
    },
    update: Object.keys(update).length ? update : {},
  });

  return NextResponse.json({ success: true });
}
