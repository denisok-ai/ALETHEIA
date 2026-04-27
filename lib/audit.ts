/**
 * Audit log: write entry for admin actions.
 */
import { prisma } from './db';

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      diff: params.diff ? JSON.stringify(params.diff) : null,
    },
  });
}
