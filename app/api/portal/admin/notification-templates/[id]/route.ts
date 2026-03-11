/**
 * Admin: один шаблон уведомления — GET, PATCH, DELETE.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const template = await prisma.notificationTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, subject: true, body: true, type: true, createdAt: true, updatedAt: true },
  });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: { name?: string; subject?: string | null; body?: string; type?: string } = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (body.subject !== undefined) data.subject = body.subject === null || body.subject === '' ? null : String(body.subject);
  if (typeof body.body === 'string') data.body = body.body;
  if (typeof body.type === 'string' && ['internal', 'email', 'both'].includes(body.type)) data.type = body.type;

  const template = await prisma.notificationTemplate.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'notification_template.update',
    entity: 'NotificationTemplate',
    entityId: id,
    diff: data,
  });

  return NextResponse.json({
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    type: template.type,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.notificationTemplate.findUnique({
    where: { id },
    include: { _count: { select: { notificationSets: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing._count.notificationSets > 0) {
    return NextResponse.json(
      { error: 'Шаблон используется в наборах уведомлений. Сначала отвяжите его от наборов.' },
      { status: 400 }
    );
  }

  await prisma.notificationTemplate.delete({ where: { id } });
  await writeAuditLog({
    actorId: auth.userId,
    action: 'notification_template.delete',
    entity: 'NotificationTemplate',
    entityId: id,
    diff: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
