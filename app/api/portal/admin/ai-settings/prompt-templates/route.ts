/**
 * Admin: list and create prompt templates (chatbot scope). One active per scope.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SCOPE = 'chatbot';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.promptTemplate.findMany({
    where: { scope: SCOPE },
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

  let body: { name?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : 'Новый шаблон';
  const content = typeof body.content === 'string' ? body.content : '';

  const template = await prisma.promptTemplate.create({
    data: { name, content, scope: SCOPE, isActive: false },
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
