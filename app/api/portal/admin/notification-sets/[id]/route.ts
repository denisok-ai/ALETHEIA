/**
 * Admin: один набор уведомлений — GET (с шаблоном), PATCH (name, isDefault, isActive, templateId).
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
  const set = await prisma.notificationSet.findUnique({
    where: { id },
    include: { template: { select: { id: true, name: true } } },
  });
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: set.id,
    eventType: set.eventType,
    name: set.name,
    isDefault: set.isDefault,
    isActive: set.isActive,
    templateId: set.templateId,
    template: set.template,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.notificationSet.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: { name?: string; isDefault?: boolean; isActive?: boolean; templateId?: string | null } = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.isDefault === 'boolean') data.isDefault = body.isDefault;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (body.templateId === null || body.templateId === '') data.templateId = null;
  else if (typeof body.templateId === 'string' && body.templateId.trim()) data.templateId = body.templateId.trim();

  const updated = await prisma.notificationSet.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'notification_set.update',
    entity: 'NotificationSet',
    entityId: id,
    diff: data,
  });

  return NextResponse.json({
    id: updated.id,
    eventType: updated.eventType,
    name: updated.name,
    isDefault: updated.isDefault,
    isActive: updated.isActive,
    templateId: updated.templateId,
  });
}
