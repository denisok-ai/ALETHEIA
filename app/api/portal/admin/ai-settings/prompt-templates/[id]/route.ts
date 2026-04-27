/**
 * Admin: get/update/delete prompt template, set active.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const t = await prisma.promptTemplate.findFirst({ where: { id } });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: t.id,
    name: t.name,
    content: t.content,
    scope: t.scope,
    isActive: t.isActive,
    usageCount: t.usageCount,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const t = await prisma.promptTemplate.findFirst({ where: { id } });
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { name?: string; content?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: { name?: string; content?: string; isActive?: boolean } = {};
  if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 200);
  if (typeof body.content === 'string') data.content = body.content;
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
    if (body.isActive) {
      await prisma.promptTemplate.updateMany({
        where: { scope: t.scope, id: { not: id } },
        data: { isActive: false },
      });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      id: t.id,
      name: t.name,
      content: t.content,
      scope: t.scope,
      isActive: t.isActive,
      usageCount: t.usageCount,
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    });
  }

  const updated = await prisma.promptTemplate.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    content: updated.content,
    scope: updated.scope,
    isActive: updated.isActive,
    usageCount: updated.usageCount,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.promptTemplate.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
