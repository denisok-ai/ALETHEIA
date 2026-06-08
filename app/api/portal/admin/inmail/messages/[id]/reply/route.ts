/**
 * Admin: ответ на письмо через SMTP ящика.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { inmailReplySchema } from '@/lib/validations/inmail';
import { sendInmailReply } from '@/lib/inmail-smtp';
import sanitizeHtml from 'sanitize-html';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inmailReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const msg = await prisma.inboundMessage.findUnique({
    where: { id },
    include: { mailbox: true },
  });
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const subj = msg.subject?.trim() || '';
  const replySubject = subj.toLowerCase().startsWith('re:') ? subj : `Re: ${subj || '(без темы)'}`;

  let htmlOut: string | undefined;
  if (parsed.data.html?.trim()) {
    htmlOut = sanitizeHtml(parsed.data.html, {
      allowedTags: sanitizeHtml.defaults.allowedTags,
      allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
    });
  }

  const refs = [msg.references, msg.messageId].filter(Boolean).join(' ').trim() || null;

  const result = await sendInmailReply({
    mailboxId: msg.mailboxId,
    toAddress: msg.fromAddress,
    subject: replySubject,
    text: parsed.data.text,
    html: htmlOut,
    inReplyToMessageId: msg.messageId,
    references: refs,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
