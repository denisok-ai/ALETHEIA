/**
 * Admin: list and create prompt templates. Scopes: chatbot (лендинг), course-tutor (плеер). One active per scope.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SCOPES = ['chatbot', 'course-tutor'] as const;
type PromptScope = (typeof SCOPES)[number];

function parseScope(raw: string | null): PromptScope {
  if (raw === 'course-tutor') return 'course-tutor';
  return 'chatbot';
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const scope = parseScope(request.nextUrl.searchParams.get('scope'));

  const list = await prisma.promptTemplate.findMany({
    where: { scope },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });

  return NextResponse.json({
    templates: list.map((t) => ({
      id: t.id,
      name: t.name,
      content: t.content,
      scope: t.scope,
      isActive: t.isActive,
      usageCount: t.usageCount,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { name?: string; content?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : 'Новый шаблон';
  const content = typeof body.content === 'string' ? body.content : '';
  const scope =
    typeof body.scope === 'string' && SCOPES.includes(body.scope as PromptScope)
      ? (body.scope as PromptScope)
      : 'chatbot';

  const template = await prisma.promptTemplate.create({
    data: { name, content, scope, isActive: false },
  });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    content: template.content,
    scope: template.scope,
    isActive: template.isActive,
    usageCount: template.usageCount,
    lastUsedAt: null,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  });
}
