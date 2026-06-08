import type { InboundMailbox, InboundMessage, User } from '@prisma/client';

export function mailboxToDto(m: InboundMailbox) {
  return {
    id: m.id,
    label: m.label,
    imapHost: m.imapHost,
    imapPort: m.imapPort,
    imapTls: m.imapTls,
    username: m.username,
    folder: m.folder,
    lastUid: m.lastUid,
    lastSyncedAt: m.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: m.lastSyncStatus,
    lastSyncError: m.lastSyncError,
    lastSyncCheckedAt: m.lastSyncCheckedAt?.toISOString() ?? null,
    retentionDays: m.retentionDays,
    enabled: m.enabled,
    smtpHost: m.smtpHost,
    smtpPort: m.smtpPort,
    smtpTls: m.smtpTls,
    hasPassword: Boolean(m.passwordEnc?.length),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function messageListItemDto(
  m: InboundMessage & {
    mailbox: { label: string };
    matchedUser: Pick<User, 'id' | 'email' | 'displayName'> | null;
  }
) {
  return {
    id: m.id,
    mailboxId: m.mailboxId,
    mailboxLabel: m.mailbox.label,
    imapUid: m.imapUid,
    messageId: m.messageId,
    fromAddress: m.fromAddress,
    fromName: m.fromName,
    subject: m.subject,
    receivedAt: m.receivedAt.toISOString(),
    snippet: m.snippet,
    hasAttachments: m.hasAttachments,
    matchedUserId: m.matchedUserId,
    matchedUser: m.matchedUser
      ? {
          id: m.matchedUser.id,
          email: m.matchedUser.email,
          displayName: m.matchedUser.displayName,
        }
      : null,
  };
}

export function messageDetailDto(
  m: InboundMessage & {
    mailbox: { label: string; id: string };
    matchedUser: Pick<User, 'id' | 'email' | 'displayName'> | null;
  }
) {
  let toAddresses: string[] = [];
  try {
    const p = JSON.parse(m.toAddresses) as unknown;
    if (Array.isArray(p)) toAddresses = p.filter((x): x is string => typeof x === 'string');
  } catch {
    /* ignore */
  }
  return {
    ...messageListItemDto(m),
    toAddresses,
    inReplyTo: m.inReplyTo,
    references: m.references,
    bodyText: m.bodyText,
    bodyHtml: m.bodyHtml,
  };
}
