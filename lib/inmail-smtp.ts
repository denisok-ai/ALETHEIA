/**
 * Исходящие ответы с ящика IMAP через SMTP (nodemailer).
 */
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';
import { normalizeMailboxUser, normalizeMailCred } from '@/lib/mail-creds';
import { mailImapTlsRejectUnauthorized } from '@/lib/mail-stack-env';

export type SendInmailReplyResult = { ok: true } | { ok: false; error: string };

function formatMessageId(id: string): string {
  const t = id.trim();
  if (!t) return t;
  return t.startsWith('<') ? t : `<${t}>`;
}

export async function sendInmailReply(params: {
  mailboxId: string;
  toAddress: string;
  subject: string;
  text: string;
  html?: string;
  inReplyToMessageId?: string | null;
  references?: string | null;
}): Promise<SendInmailReplyResult> {
  const mb = await prisma.inboundMailbox.findUnique({ where: { id: params.mailboxId } });
  if (!mb) return { ok: false, error: 'Ящик не найден' };
  if (!mb.enabled) return { ok: false, error: 'Ящик отключён' };

  const host = mb.smtpHost?.trim() || mb.imapHost;
  const port = mb.smtpPort ?? 587;
  const secure = port === 465;
  const requireTLS = port === 587 && mb.smtpTls !== false;

  let pass: string;
  try {
    pass = normalizeMailCred(decrypt(mb.passwordEnc));
  } catch {
    return { ok: false, error: 'Не удалось расшифровать пароль' };
  }

  const tlsStrict = mailImapTlsRejectUnauthorized();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user: normalizeMailboxUser(mb.username), pass },
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });

  const fromAddr = mb.username.includes('@') ? mb.username : mb.username;
  const fromHeader = `"${mb.label.replace(/"/g, '')}" <${fromAddr}>`;

  const headers: Record<string, string> = {};
  if (params.inReplyToMessageId) {
    headers['In-Reply-To'] = formatMessageId(params.inReplyToMessageId);
  }
  if (params.references?.trim()) {
    headers['References'] = params.references.trim();
  }

  try {
    await transporter.sendMail({
      from: fromHeader,
      to: params.toAddress,
      subject: params.subject,
      text: params.text,
      html: params.html,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка SMTP' };
  }
}
