/**
 * Admin: ручная синхронизация одного ящика.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncInboundMailbox } from '@/lib/inmail-sync';
import { checkManualInmailSyncCooldown } from '@/lib/inmail-manual-sync-limit';

export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const mb = await prisma.inboundMailbox.findUnique({ where: { id } });
  if (!mb) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rate = checkManualInmailSyncCooldown(id);
  if (rate) return rate;

  const result = await syncInboundMailbox(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Sync failed', imported: result.imported }, { status: 502 });
  }
  return NextResponse.json({ ok: true, imported: result.imported });
}
