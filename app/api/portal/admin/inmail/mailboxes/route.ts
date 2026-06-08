/**
 * Admin: список и создание IMAP-ящиков входящей почты.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { writeAuditLog } from '@/lib/audit';
import { inboundMailboxCreateSchema } from '@/lib/validations/inmail';
import { mailboxToDto } from '@/lib/inmail-dto';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.inboundMailbox.findMany({ orderBy: { label: 'asc' } });
  return NextResponse.json({ mailboxes: rows.map(mailboxToDto) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inboundMailboxCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  let passwordEnc: string;
  try {
    passwordEnc = encrypt(d.password);
  } catch {
    return NextResponse.json({ error: 'Шифрование пароля невозможно (NEXTAUTH_SECRET)' }, { status: 500 });
  }

  const row = await prisma.inboundMailbox.create({
    data: {
      label: d.label,
      imapHost: d.imapHost,
      imapPort: d.imapPort,
      imapTls: d.imapTls,
      username: d.username,
      passwordEnc,
      folder: d.folder,
      enabled: d.enabled,
      smtpHost: d.smtpHost ?? null,
      smtpPort: d.smtpPort ?? null,
      smtpTls: d.smtpTls ?? true,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'inmail_mailbox_create',
    entity: 'InboundMailbox',
    entityId: row.id,
    diff: { label: row.label, imapHost: row.imapHost },
  });

  return NextResponse.json({ mailbox: mailboxToDto(row) });
}
