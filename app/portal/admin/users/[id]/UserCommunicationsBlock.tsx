'use client';

/**
 * Админ: вкладка «Коммуникации» — журнал писем, рассылки, уведомления ЛК.
 */
import Link from 'next/link';
import { format } from 'date-fns';
import { Mail, Bell, FileText, MessageSquare, ExternalLink, RadioTower, Inbox } from 'lucide-react';
import { Card } from '@/components/portal/Card';

export type NotificationLogItem = {
  id: string;
  eventType: string;
  subject: string | null;
  channel: string;
  content: string;
  createdAt: string;
};

export type MailingLogItem = {
  id: string;
  status: string;
  recipientEmail: string;
  sentAt: string | null;
  createdAt: string;
  mailing: { internalTitle: string; emailSubject: string };
};

export type InAppNotificationItem = {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

/** Запись общего журнала исходящей почты (`EmailDeliveryLog`) — без тела письма. */
export type EmailDeliveryLogItem = {
  id: string;
  module: string;
  entityId: string | null;
  recipient: string;
  subject: string | null;
  status: string;
  provider: string;
  createdAt: string;
  errorMessage: string | null;
};

export type InboundMatchedMessageItem = {
  id: string;
  subject: string | null;
  fromAddress: string;
  receivedAt: string;
  snippet: string | null;
  mailboxLabel: string;
};

export function UserCommunicationsBlock({
  userId,
  accountEmail,
  notificationLogs,
  mailingLogs,
  inAppNotifications,
  emailDeliveryLogs,
  inboundMatchedMessages,
}: {
  userId: string;
  accountEmail: string;
  notificationLogs: NotificationLogItem[];
  mailingLogs: MailingLogItem[];
  inAppNotifications: InAppNotificationItem[];
  emailDeliveryLogs: EmailDeliveryLogItem[];
  inboundMatchedMessages: InboundMatchedMessageItem[];
}) {
  const ticketsHref = `/portal/manager/tickets?userId=${encodeURIComponent(userId)}`;

  return (
    <div className="space-y-6">
      <Card title="Мост в поддержку">
        <p className="text-sm text-[var(--portal-text-muted)]">
          Откройте список тикетов с фильтром по этому пользователю или перейдите к переписке.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={ticketsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
          >
            <MessageSquare className="h-4 w-4" />
            Тикеты пользователя
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <Link
            href="/portal/admin/mailings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
          >
            <Mail className="h-4 w-4" />
            Рассылки
          </Link>
        </div>
        <p className="mt-2 text-xs text-[var(--portal-text-muted)]">Email в системе: {accountEmail}</p>
      </Card>

      <Card
        title="Системный журнал исходящей почты"
        description="Метаданные всех исходящих отправок через Resend/SMTP (модуль, статус, провайдер). Тело письма здесь не хранится."
      >
        {emailDeliveryLogs.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Записей пока нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {emailDeliveryLogs.map((row) => (
              <li key={row.id} className="border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <RadioTower className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                  <span className="text-xs text-[var(--portal-text-muted)]">
                    {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                  </span>
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">{row.module}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.provider}</span>
                  <span
                    className={
                      row.status === 'sent'
                        ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
                        : row.status === 'skipped'
                          ? 'rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900'
                          : 'rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800'
                    }
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 font-medium line-clamp-2">{row.subject ?? '—'}</p>
                <p className="text-xs text-[var(--portal-text-muted)]">Кому: {row.recipient}</p>
                {row.errorMessage ? (
                  <p className="mt-1 text-xs text-red-700">{row.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Входящие IMAP (сопоставление)"
        description="Письма из раздела «Входящие», автоматически сопоставленные с этим пользователем по email. Ответы на такие письма идут через SMTP ящика, не через Resend."
      >
        {inboundMatchedMessages.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Сопоставленных входящих писем нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {inboundMatchedMessages.map((row) => (
              <li key={row.id} className="border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Inbox className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                  <span className="text-xs text-[var(--portal-text-muted)]">
                    {format(new Date(row.receivedAt), 'dd.MM.yyyy HH:mm')}
                  </span>
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">{row.mailboxLabel}</span>
                </div>
                <p className="mt-0.5 font-medium">{row.subject ?? '(без темы)'}</p>
                <p className="text-xs text-[var(--portal-text-muted)]">От: {row.fromAddress}</p>
                {row.snippet ? <p className="mt-1 line-clamp-2 text-[var(--portal-text-muted)]">{row.snippet}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs">
          <Link href="/portal/admin/mail?tab=inbox" className="text-[var(--portal-accent)] hover:underline">
            Открыть модуль «Входящие»
          </Link>
        </p>
      </Card>

      <Card title="Журнал уведомлений (email / внутр.)" description="Последние записи из журнала отправок">
        {notificationLogs.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Записей пока нет.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {notificationLogs.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-2 border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                <FileText className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                <span className="text-xs text-[var(--portal-text-muted)]">
                  {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                </span>
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">{row.channel}</span>
                <span className="font-medium">{row.eventType}</span>
                {row.subject ? <span className="text-[var(--portal-text-muted)]">— {row.subject}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Рассылки" description="Логи доставки по этому пользователю">
        {mailingLogs.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Отправок по рассылкам не найдено.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {mailingLogs.map((row) => (
              <li key={row.id} className="border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--portal-text-muted)]" />
                  <span className="text-xs text-[var(--portal-text-muted)]">
                    {row.sentAt
                      ? format(new Date(row.sentAt), 'dd.MM.yyyy HH:mm')
                      : format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                  </span>
                  <span
                    className={
                      row.status === 'sent'
                        ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
                        : 'rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800'
                    }
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 font-medium">{row.mailing.internalTitle}</p>
                <p className="text-xs text-[var(--portal-text-muted)]">{row.mailing.emailSubject}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Уведомления в личном кабинете" description="Внутренние уведомления пользователя">
        {inAppNotifications.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Нет уведомлений.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {inAppNotifications.map((row) => {
              let preview = row.content;
              try {
                const j = JSON.parse(row.content) as Record<string, unknown>;
                if (typeof j.title === 'string') preview = j.title;
                else if (typeof j.message === 'string') preview = j.message;
              } catch {
                /* raw string */
              }
              return (
                <li key={row.id} className="flex gap-2 border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                  <Bell className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--portal-text-muted)]">
                        {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                      </span>
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">{row.type}</span>
                      {!row.isRead ? <span className="text-xs text-[var(--portal-accent)]">не прочитано</span> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[var(--portal-text-muted)]">{preview}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
