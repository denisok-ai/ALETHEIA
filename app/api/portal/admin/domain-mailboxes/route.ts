/**
 * Admin: список доменных ящиков (Mailcow + InboundMailbox) и создание нового.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { createDomainMailbox } from '@/lib/domain-mailbox-service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.domainMailbox.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      localPart: true,
      domain: true,
      label: true,
      status: true,
      provisioningKind: true,
      createdAt: true,
      inboundMailbox: {
        select: {
          id: true,
          enabled: true,
          lastSyncedAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
          lastSyncCheckedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { localPart?: string; label?: string; password?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const localPart = (body.localPart ?? '').trim();
  const label = (body.label ?? '').trim();
  if (!localPart) {
    return NextResponse.json({ error: 'Укажите имя ящика (до @)' }, { status: 400 });
  }

  const result = await createDomainMailbox({
    localPart,
    label: label || localPart,
    password: body.password?.trim() || undefined,
    domain: body.domain?.trim(),
    createdById: auth.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    domainMailboxId: result.domainMailboxId,
    email: result.email,
    inboundMailboxId: result.inboundMailboxId,
    plainPassword: result.plainPassword,
    mailcowSummary: result.mailcowSummary,
  });
}
