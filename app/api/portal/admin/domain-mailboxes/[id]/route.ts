/**
 * Admin: приостановка / возобновление / удаление доменного ящика.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import {
  deleteDomainMailbox,
  resumeDomainMailbox,
  suspendDomainMailbox,
} from '@/lib/domain-mailbox-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = (body.action ?? '').trim().toLowerCase();
  if (action === 'suspend') {
    const r = await suspendDomainMailbox(id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (action === 'resume') {
    const r = await resumeDomainMailbox(id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  return NextResponse.json({ error: 'Ожидается action: suspend | resume' }, { status: 400 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const r = await deleteDomainMailbox(id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
