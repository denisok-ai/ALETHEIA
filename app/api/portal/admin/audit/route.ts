/**
 * Admin: audit log list with optional filters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action')?.trim() || undefined;
  const entity = searchParams.get('entity')?.trim() || undefined;
  const entityId = searchParams.get('entityId')?.trim() || undefined;
  const actorId = searchParams.get('actorId')?.trim() || undefined;
  const dateFrom = searchParams.get('dateFrom')?.trim() || undefined;
  const dateTo = searchParams.get('dateTo')?.trim() || undefined;

  const where: { action?: string; entity?: string; entityId?: string; actorId?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
  if (action) where.action = action;
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (actorId) where.actorId = actorId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      actorId: l.actorId,
      diff: l.diff,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
