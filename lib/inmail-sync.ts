/**
 * Синхронизация входящей почты по IMAP → InboundMessage.
 */
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';
import { normalizeMailboxUser, normalizeMailCred } from '@/lib/mail-creds';
import { mailImapTlsRejectUnauthorized } from '@/lib/mail-stack-env';

const FIRST_SYNC_UID_WINDOW = 100;
const MAX_MESSAGES_PER_RUN = 200;
const SYNC_ERROR_MAX_LEN = 500;

/** Санитизация HTML входящих писем перед сохранением и показом в админке. */
export function sanitizeInboundHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2', 'h3'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
  });
}

async function recordMailboxSyncOk(
  mailboxId: string,
  data: {
    lastUid?: number | null;
    lastSyncedAt?: Date | null;
  }
): Promise<void> {
  await prisma.inboundMailbox.update({
    where: { id: mailboxId },
    data: {
      ...(data.lastUid !== undefined ? { lastUid: data.lastUid } : {}),
      ...(data.lastSyncedAt !== undefined ? { lastSyncedAt: data.lastSyncedAt } : {}),
      lastSyncStatus: 'ok',
      lastSyncError: null,
      lastSyncCheckedAt: new Date(),
    },
  });
}

async function recordMailboxSyncError(mailboxId: string, errorMessage: string): Promise<void> {
  await prisma.inboundMailbox.update({
    where: { id: mailboxId },
    data: {
      lastSyncStatus: 'error',
      lastSyncError: errorMessage.slice(0, SYNC_ERROR_MAX_LEN),
      lastSyncCheckedAt: new Date(),
    },
  });
}

function primaryFrom(parsed: ParsedMail): { address: string; name: string | null } {
  const from = parsed.from;
  if (!from) return { address: 'unknown', name: null };
  const first = Array.isArray(from) ? from[0] : from;
  const v = first && 'value' in first && Array.isArray(first.value) ? first.value[0] : undefined;
  if (v?.address) {
    return { address: v.address.trim(), name: v.name?.trim() || null };
  }
  return { address: 'unknown', name: null };
}

function addressListValues(
  list: ParsedMail['to'] | ParsedMail['cc']
): { address?: string }[] {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  const values: { address?: string }[] = [];
  for (const item of arr) {
    if ('value' in item && Array.isArray(item.value)) {
      values.push(...item.value);
    }
  }
  return values;
}

function collectToAddresses(parsed: ParsedMail): string[] {
  const out: string[] = [];
  for (const x of [...addressListValues(parsed.to), ...addressListValues(parsed.cc)]) {
    if (x.address) out.push(x.address.trim());
  }
  return Array.from(new Set(out));
}

function normalizeMessageId(id: string | undefined): string | null {
  if (!id) return null;
  const s = id.trim().replace(/^<|>$/g, '');
  return s.length ? s : null;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const row = await prisma.user.findUnique({
    where: { email: key },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** ImapFlow подставляет message «Command failed», детали — в responseText (ответ Dovecot). */
function formatImapFlowError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const x = e as Error & {
    responseText?: string;
    responseStatus?: string;
    authenticationFailed?: boolean;
    code?: string;
  };
  const detail = typeof x.responseText === 'string' ? x.responseText.trim() : '';
  if (detail) {
    const tag = x.responseStatus ? `[${x.responseStatus}] ` : '';
    return `${tag}${detail}`;
  }
  if (x.authenticationFailed || /authentication/i.test(e.message)) {
    return `${e.message} — проверьте пароль ящика в приложении и на почтовом сервере (Mailcow).`;
  }
  return e.message;
}

function snippetFromParsed(parsed: ParsedMail): string | null {
  const t = parsed.text?.trim();
  if (t) return t.slice(0, 240);
  const h = parsed.html;
  if (h) {
    const plain = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.slice(0, 240) || null;
  }
  return null;
}

export type SyncMailboxResult = {
  ok: boolean;
  imported: number;
  error?: string;
};

export async function syncInboundMailbox(mailboxId: string): Promise<SyncMailboxResult> {
  const mb = await prisma.inboundMailbox.findUnique({ where: { id: mailboxId } });
  if (!mb) {
    return { ok: false, imported: 0, error: 'Mailbox not found' };
  }
  if (!mb.enabled) {
    return { ok: true, imported: 0 };
  }

  let password: string;
  try {
    password = normalizeMailCred(decrypt(mb.passwordEnc));
  } catch {
    const err = 'Не удалось расшифровать пароль (NEXTAUTH_SECRET?)';
    await recordMailboxSyncError(mailboxId, err);
    return { ok: false, imported: 0, error: err };
  }

  const tlsStrict = mailImapTlsRejectUnauthorized();
  const client = new ImapFlow({
    host: mb.imapHost,
    port: mb.imapPort,
    secure: mb.imapTls,
    auth: { user: normalizeMailboxUser(mb.username), pass: password },
    logger: false,
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });

  let imported = 0;
  /** Максимальный UID из выборки — обновляем checkpoint, чтобы не зациклиться на битых письмах. */
  let lastSeenUid = mb.lastUid ?? 0;

  try {
    await client.connect();
    const open = await client.mailboxOpen(mb.folder);
    if (!open) {
      const err = `Не удалось открыть папку «${mb.folder}»`;
      await recordMailboxSyncError(mailboxId, err);
      return { ok: false, imported, error: err };
    }

    const uidNext = open.uidNext ?? 1;
    const lastInMailbox = uidNext > 1 ? uidNext - 1 : 0;

    let range: string;
    if (lastInMailbox < 1) {
      await recordMailboxSyncOk(mailboxId, { lastSyncedAt: new Date(), lastUid: mb.lastUid });
      return { ok: true, imported: 0 };
    }

    if (mb.lastUid == null || mb.lastUid === 0) {
      const low = Math.max(1, lastInMailbox - FIRST_SYNC_UID_WINDOW + 1);
      range = `${low}:${lastInMailbox}`;
    } else {
      if (mb.lastUid >= lastInMailbox) {
        await recordMailboxSyncOk(mailboxId, { lastSyncedAt: new Date() });
        return { ok: true, imported: 0 };
      }
      const from = mb.lastUid + 1;
      range = `${from}:*`;
    }

    let processed = 0;
    for await (const msg of client.fetch(range, { uid: true, source: true })) {
      if (processed >= MAX_MESSAGES_PER_RUN) break;
      processed += 1;
      const uid = msg.uid;
      if (typeof uid !== 'number') continue;
      lastSeenUid = Math.max(lastSeenUid, uid);

      try {
        const raw = msg.source;
        if (!raw) continue;
        const parsed = await simpleParser(raw);
        const from = primaryFrom(parsed);
        const messageId = normalizeMessageId(parsed.messageId ?? undefined);
        const inReplyToRaw = parsed.inReplyTo as string | { text?: string } | undefined;
        const inReplyTo = normalizeMessageId(
          typeof inReplyToRaw === 'string' ? inReplyToRaw : inReplyToRaw?.text
        );
        const refsRaw = parsed.references as string | unknown[] | undefined;
        const refs = Array.isArray(refsRaw)
          ? refsRaw.map((r) => (typeof r === 'string' ? r : (r as { text?: string }).text ?? '')).join(' ')
          : typeof refsRaw === 'string'
            ? refsRaw
            : null;

        let bodyHtml: string | null = null;
        if (parsed.html) {
          bodyHtml = sanitizeInboundHtml(parsed.html);
        }
        const bodyText = parsed.text?.trim() || null;
        const matchedUserId = await findUserIdByEmail(from.address);
        const hasAttachments = (parsed.attachments?.length ?? 0) > 0;
        const receivedAt = parsed.date ?? new Date();
        const subject = parsed.subject?.trim() || null;
        const snippet = snippetFromParsed(parsed);

        await prisma.inboundMessage.upsert({
          where: { mailboxId_imapUid: { mailboxId, imapUid: uid } },
          create: {
            mailboxId,
            imapUid: uid,
            messageId,
            inReplyTo,
            references: refs,
            fromAddress: from.address,
            fromName: from.name,
            toAddresses: JSON.stringify(collectToAddresses(parsed)),
            subject,
            receivedAt,
            bodyText,
            bodyHtml,
            matchedUserId,
            hasAttachments,
            snippet,
          },
          update: {
            messageId,
            inReplyTo,
            references: refs,
            fromAddress: from.address,
            fromName: from.name,
            toAddresses: JSON.stringify(collectToAddresses(parsed)),
            subject,
            receivedAt,
            bodyText,
            bodyHtml,
            matchedUserId,
            hasAttachments,
            snippet,
          },
        });

        imported += 1;
      } catch (e) {
        console.error('[inmail-sync] UID', uid, e instanceof Error ? e.message : e);
      }
    }

    await recordMailboxSyncOk(mailboxId, { lastUid: lastSeenUid, lastSyncedAt: new Date() });

    return { ok: true, imported };
  } catch (e) {
    const msg = formatImapFlowError(e);
    console.error('[inmail-sync]', mailboxId, msg, e);
    await recordMailboxSyncError(mailboxId, msg);
    return { ok: false, imported, error: msg };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

export async function syncAllEnabledMailboxes(): Promise<{ mailboxId: string; result: SyncMailboxResult }[]> {
  const boxes = await prisma.inboundMailbox.findMany({ where: { enabled: true }, select: { id: true } });
  const out: { mailboxId: string; result: SyncMailboxResult }[] = [];
  for (const b of boxes) {
    out.push({ mailboxId: b.id, result: await syncInboundMailbox(b.id) });
  }
  return out;
}
