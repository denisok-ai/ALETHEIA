/**
 * Admin: list saved LLM API keys (GET), create new (POST). Keys stored encrypted.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.llmApiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, provider: true, createdAt: true },
  });
  return NextResponse.json({ apiKeys: list });
}

type Body = { name: string; provider: string; api_key: string };

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const provider = typeof body.provider === 'string' ? body.provider.trim() : 'deepseek';
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  if (!name || !apiKey) {
    return NextResponse.json({ error: 'Укажите название и API-ключ' }, { status: 400 });
  }

  try {
    const encrypted = encrypt(apiKey);
    const created = await prisma.llmApiKey.create({
      data: { name, provider, apiKeyEncrypted: encrypted },
      select: { id: true, name: true, provider: true, createdAt: true },
    });
    return NextResponse.json({ apiKey: created });
  } catch (e) {
    return NextResponse.json({ error: 'Ошибка сохранения ключа. Проверьте NEXTAUTH_SECRET.' }, { status: 500 });
  }
}
