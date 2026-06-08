/**
 * Admin: ручная синхронизация одного IMAP-ящика.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { syncInboundMailbox } from '@/lib/inmail-sync';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const result = await syncInboundMailbox(id);
  return NextResponse.json(result);
}
