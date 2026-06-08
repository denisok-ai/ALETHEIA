/**
 * Admin: один IMAP-ящик — чтение, обновление, удаление.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { writeAuditLog } from '@/lib/audit';
import { inboundMailboxPatchSchema } from '@/lib/validations/inmail';
import { mailboxToDto } from '@/lib/inmail-dto';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const row = await prisma.inboundMailbox.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ mailbox: mailboxToDto(row) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inboundMailboxPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.inboundMailbox.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const d = parsed.data;
  const data: Prisma.InboundMailboxUpdateInput = {};

  if (d.label !== undefined) data.label = d.label;
  if (d.imapHost !== undefined) data.imapHost = d.imapHost;
  if (d.imapPort !== undefined) data.imapPort = d.imapPort;
  if (d.imapTls !== undefined) data.imapTls = d.imapTls;
  if (d.username !== undefined) data.username = d.username;
  if (d.folder !== undefined) data.folder = d.folder;
  if (d.enabled !== undefined) data.enabled = d.enabled;
  if (d.smtpHost !== undefined) data.smtpHost = d.smtpHost;
  if (d.smtpPort !== undefined) data.smtpPort = d.smtpPort;
  if (d.smtpTls !== undefined) data.smtpTls = d.smtpTls;

  if (d.password !== undefined && d.password.length > 0) {
    try {
      data.passwordEnc = encrypt(d.password);
    } catch {
      return NextResponse.json({ error: 'Шифрование пароля невозможно' }, { status: 500 });
    }
  }

  const row = await prisma.inboundMailbox.update({ where: { id }, data });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'inmail_mailbox_update',
    entity: 'InboundMailbox',
    entityId: id,
    diff: { keys: Object.keys(d) },
  });

  return NextResponse.json({ mailbox: mailboxToDto(row) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const existing = await prisma.inboundMailbox.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.inboundMailbox.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'inmail_mailbox_delete',
    entity: 'InboundMailbox',
    entityId: id,
    diff: { label: existing.label },
  });

  return NextResponse.json({ ok: true });
}
