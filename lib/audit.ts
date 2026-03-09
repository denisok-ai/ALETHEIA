/**
 * Audit log: write entry for admin actions.
 */
import { createClient } from '@/lib/supabase/server';

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.from('audit_log').insert({
    actor_id: params.actorId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    diff: params.diff ?? null,
  });
}
