/**
 * Данные для центра почты админки: обзор транспорта, счётчики, последние ошибки, журналы.
 */
import type { DomainMailboxRow } from '@/app/portal/admin/domain-mailboxes/DomainMailboxesAdminClient';
import type { InmailMailboxRow } from '@/app/portal/admin/inmail/InmailAdminClient';
import { prisma } from '@/lib/db';
import { getMailDomain, getMailProvisioningMode, getMailSmtpPort } from '@/lib/mail-stack-env';

const MAIL_SETTING_KEYS = [
  'email_transport',
  'resend_api_key',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_password',
] as const;

export type MailTransportOverview = {
  /** Режим в БД/env: пусто = авто */
  transportRaw: string;
  effectiveMode: 'auto' | 'resend' | 'smtp';
  ready: boolean;
  /** Короткая строка для карточки «Обзор» */
  label: string;
};

export type MailSyncErrorRow = {
  label: string;
  error: string;
};

export type MailUnifiedLogRow = {
  id: string;
  source: 'delivery' | 'comms' | 'mailing';
  at: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  error: string | null;
};

export type MailCenterServerPayload = {
  transport: MailTransportOverview;
  mailboxCount: number;
  inboundCount: number;
  inboundEnabledCount: number;
  syncErrors: MailSyncErrorRow[];
  overviewFailures: MailUnifiedLogRow[];
  logsInitial: MailUnifiedLogRow[];
  domainMailboxes: DomainMailboxRow[];
  inmailRows: InmailMailboxRow[];
  provisioningMode: string;
  mailDomain: string;
};

function mergeSetting(key: string, fromDb: Record<string, string>, envFallback: string): string {
  const v = fromDb[key];
  if (v !== undefined && v !== '') return v;
  return envFallback;
}

/** Логика «готовности» транспорта совпадает с OutboundMailSettingsBlock / старыми настройками. */
export async function getMailTransportOverview(): Promise<MailTransportOverview> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...MAIL_SETTING_KEYS] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;

  const envFb: Record<string, string> = {
    email_transport: process.env.EMAIL_TRANSPORT ?? '',
    resend_api_key: process.env.RESEND_API_KEY ?? '',
    smtp_host: process.env.SMTP_HOST ?? '',
    smtp_port: process.env.SMTP_PORT ?? String(getMailSmtpPort()),
    smtp_user: process.env.SMTP_USER ?? '',
    smtp_password: process.env.SMTP_PASSWORD ?? '',
  };

  const transportRaw = mergeSetting('email_transport', byKey, envFb.email_transport).trim().toLowerCase();
  const effectiveMode =
    transportRaw === '' || transportRaw === 'auto'
      ? 'auto'
      : transportRaw === 'resend'
        ? 'resend'
        : transportRaw === 'smtp'
          ? 'smtp'
          : 'auto';

  const hasResendKey =
    !!(byKey.resend_api_key && byKey.resend_api_key.length > 0) || !!(envFb.resend_api_key?.trim());
  const smtpPwdOk = !!(byKey.smtp_password && byKey.smtp_password.length > 0) || !!(envFb.smtp_password?.trim());
  const smtpHost = mergeSetting('smtp_host', byKey, envFb.smtp_host).trim();
  const smtpUser = mergeSetting('smtp_user', byKey, envFb.smtp_user).trim();
  const smtpComplete = !!(smtpHost && smtpUser && smtpPwdOk);

  let ready = false;
  if (effectiveMode === 'resend') ready = hasResendKey;
  else if (effectiveMode === 'smtp') ready = smtpComplete;
  else ready = hasResendKey || smtpComplete;

  let label = '';
  if (!ready) {
    label =
      effectiveMode === 'resend'
        ? 'Укажите ключ Resend или переключите режим.'
        : effectiveMode === 'smtp'
          ? 'Заполните SMTP (хост, пользователь, пароль) или переключите режим.'
          : 'Настройте Resend или SMTP в разделе «Доставка».';
  } else if (effectiveMode === 'auto') {
    label = hasResendKey ? 'Авто: отправка через Resend (ключ найден)' : 'Авто: отправка через SMTP';
  } else if (effectiveMode === 'resend') {
    label = 'Только Resend — готово к отправке';
  } else {
    label = 'Только SMTP — готово к отправке';
  }

  return {
    transportRaw,
    effectiveMode,
    ready,
    label,
  };
}

function toUnifiedDelivery(r: {
  id: string;
  createdAt: Date;
  recipient: string;
  subject: string | null;
  status: string;
  errorMessage: string | null;
}): MailUnifiedLogRow {
  return {
    id: r.id,
    source: 'delivery',
    at: r.createdAt.toISOString(),
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.errorMessage,
  };
}

function toUnifiedComms(r: {
  id: string;
  sentAt: Date;
  recipient: string;
  subject: string | null;
  status: string;
  errorMessage: string | null;
}): MailUnifiedLogRow {
  return {
    id: r.id,
    source: 'comms',
    at: r.sentAt.toISOString(),
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.errorMessage,
  };
}

function toUnifiedMailing(r: {
  id: string;
  createdAt: Date;
  recipientEmail: string;
  status: string;
  errorMessage: string | null;
}): MailUnifiedLogRow {
  return {
    id: r.id,
    source: 'mailing',
    at: r.createdAt.toISOString(),
    recipient: r.recipientEmail,
    subject: null,
    status: r.status,
    error: r.errorMessage,
  };
}

export async function loadMailCenterPayload(): Promise<MailCenterServerPayload> {
  const [
    transport,
    mailboxCount,
    inboundCountTotal,
    inboundEnabledCount,
    syncErrBoxes,
    emailFails,
    commsFails,
    mailingFails,
    recentDelivery,
    recentComms,
    recentMailing,
    domainRows,
    inboundRows,
  ] = await Promise.all([
    getMailTransportOverview(),
    prisma.domainMailbox.count(),
    prisma.inboundMailbox.count(),
    prisma.inboundMailbox.count({ where: { enabled: true } }),
    prisma.inboundMailbox.findMany({
      where: {
        lastSyncError: { not: null },
      },
      select: { label: true, lastSyncError: true },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.emailDeliveryLog.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        recipient: true,
        subject: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.commsSend.findMany({
      where: {
        OR: [{ status: { not: 'sent' } }, { errorMessage: { not: null } }],
      },
      orderBy: { sentAt: 'desc' },
      take: 6,
      select: {
        id: true,
        sentAt: true,
        recipient: true,
        subject: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.mailingLog.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        recipientEmail: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        recipient: true,
        subject: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.commsSend.findMany({
      orderBy: { sentAt: 'desc' },
      take: 40,
      select: {
        id: true,
        sentAt: true,
        recipient: true,
        subject: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.mailingLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        createdAt: true,
        recipientEmail: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.domainMailbox.findMany({
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
    }),
    prisma.inboundMailbox.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        username: true,
        imapHost: true,
        imapPort: true,
        enabled: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
      },
    }),
  ]);

  const syncErrors: MailSyncErrorRow[] = syncErrBoxes
    .filter((b) => (b.lastSyncError ?? '').trim().length > 0)
    .map((b) => ({
      label: b.label,
      error: (b.lastSyncError ?? '').slice(0, 500),
    }));

  const overviewFailures: MailUnifiedLogRow[] = [
    ...emailFails.map(toUnifiedDelivery),
    ...commsFails.map(toUnifiedComms),
    ...mailingFails.map(toUnifiedMailing),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);

  const mergedLogs: MailUnifiedLogRow[] = [
    ...recentDelivery.map(toUnifiedDelivery),
    ...recentComms.map(toUnifiedComms),
    ...recentMailing.map(toUnifiedMailing),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const domainMailboxes = domainRows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    inboundMailbox: r.inboundMailbox
      ? {
          ...r.inboundMailbox,
          lastSyncedAt: r.inboundMailbox.lastSyncedAt?.toISOString() ?? null,
          lastSyncCheckedAt: r.inboundMailbox.lastSyncCheckedAt?.toISOString() ?? null,
        }
      : null,
  }));

  const inmailRows = inboundRows.map((b) => ({
    ...b,
    lastSyncedAt: b.lastSyncedAt?.toISOString() ?? null,
  }));

  return {
    transport,
    mailboxCount,
    inboundCount: inboundCountTotal,
    inboundEnabledCount,
    syncErrors,
    overviewFailures,
    logsInitial: mergedLogs.slice(0, 80),
    domainMailboxes,
    inmailRows,
    provisioningMode: getMailProvisioningMode(),
    mailDomain: getMailDomain(),
  };
}
