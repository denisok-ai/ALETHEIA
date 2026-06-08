'use client';

/**
 * Центр почты админки: вкладки Обзор, Доставка, ящики, входящие, ссылки на письма/рассылки, журналы.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  LayoutGrid,
  Send,
  Server,
  Inbox,
  Mail,
  Megaphone,
  ScrollText,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { OutboundMailSettingsBlock } from '@/components/portal/admin/settings/OutboundMailSettingsBlock';
import { DomainMailboxesAdminClient } from '@/app/portal/admin/domain-mailboxes/DomainMailboxesAdminClient';
import { InmailAdminClient } from '@/app/portal/admin/inmail/InmailAdminClient';
import type { MailCenterServerPayload, MailUnifiedLogRow } from '@/lib/mail-center-server';

const TAB_IDS = ['overview', 'delivery', 'mailboxes', 'inbox', 'communications', 'mailings', 'logs'] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(v: string | null): v is TabId {
  return !!v && (TAB_IDS as readonly string[]).includes(v);
}

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutGrid },
  { id: 'delivery', label: 'Доставка', icon: Send },
  { id: 'mailboxes', label: 'Почтовые ящики', icon: Server },
  { id: 'inbox', label: 'Входящие', icon: Inbox },
  { id: 'communications', label: 'Письма и сообщения', icon: Mail },
  { id: 'mailings', label: 'Рассылки', icon: Megaphone },
  { id: 'logs', label: 'Журналы', icon: ScrollText },
];

function sourceLabel(s: MailUnifiedLogRow['source']): string {
  if (s === 'delivery') return 'Доставка (сайт)';
  if (s === 'comms') return 'Коммуникации';
  return 'Рассылки';
}

export function MailCenterClient(props: MailCenterServerPayload) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'overview';

  const [logsFilter, setLogsFilter] = useState('');

  function setTab(id: TabId) {
    router.replace(`${pathname}?tab=${id}`, { scroll: false });
  }

  const filteredLogs = useMemo(() => {
    const q = logsFilter.trim().toLowerCase();
    if (!q) return props.logsInitial;
    return props.logsInitial.filter((row) => {
      const r = (row.recipient ?? '').toLowerCase();
      const e = (row.error ?? '').toLowerCase();
      const sub = (row.subject ?? '').toLowerCase();
      return r.includes(q) || e.includes(q) || sub.includes(q);
    });
  }, [props.logsInitial, logsFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-2 md:p-3 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Разделы почты">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--portal-accent)] text-white shadow-sm'
                    : 'text-[var(--portal-text-muted)] hover:bg-[var(--portal-bg)] hover:text-[var(--portal-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <p className="text-sm text-[var(--portal-text-muted)] max-w-4xl">
        Глобальная доставка (Resend/SMTP) используется сайтом, оплатами, уведомлениями и частью рассылок. Ответы из
        «Входящих» отправляются от конкретного подключённого ящика — не от общего транспорта «Доставки».
      </p>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="portal-card p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--portal-text)]">
                {props.transport.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
                )}
                Доставка писем
              </div>
              <p className="text-sm text-[var(--portal-text-muted)]">{props.transport.label}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab('delivery')}>
                Настроить доставку
              </Button>
            </div>
            <div className="portal-card p-5 space-y-2">
              <p className="text-sm font-medium text-[var(--portal-text)]">Почтовые ящики @{props.mailDomain}</p>
              <p className="text-2xl font-semibold tabular-nums">{props.mailboxCount}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab('mailboxes')}>
                Управлять ящиками
              </Button>
            </div>
            <div className="portal-card p-5 space-y-2">
              <p className="text-sm font-medium text-[var(--portal-text)]">Входящие (IMAP)</p>
              <p className="text-sm text-[var(--portal-text-muted)]">
                Подключено: <strong>{props.inboundEnabledCount}</strong> из {props.inboundCount}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab('inbox')}>
                Открыть входящие
              </Button>
            </div>
          </div>

          {props.syncErrors.length > 0 && (
            <div className="portal-card border-amber-200 bg-amber-50/80 p-5 space-y-3">
              <div className="flex items-center gap-2 font-medium text-amber-950">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Ошибки синхронизации IMAP
              </div>
              <ul className="space-y-2 text-sm">
                {props.syncErrors.map((s, i) => (
                  <li key={`${s.label}-${i}`}>
                    <strong className="text-[var(--portal-text)]">{s.label}:</strong>{' '}
                    <span className="text-amber-900">{s.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="portal-card p-5 space-y-3">
            <h3 className="text-base font-semibold text-[var(--portal-text)]">Последние сбои отправки</h3>
            {props.overviewFailures.length === 0 ? (
              <p className="text-sm text-[var(--portal-text-muted)]">Ошибок по журналам не найдено.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--portal-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--portal-border)] bg-[#F8FAFC] text-left text-xs text-[var(--portal-text-muted)]">
                      <th className="px-3 py-2 font-medium">Когда</th>
                      <th className="px-3 py-2 font-medium">Источник</th>
                      <th className="px-3 py-2 font-medium">Кому</th>
                      <th className="px-3 py-2 font-medium">Ошибка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.overviewFailures.map((row) => (
                      <tr key={`${row.source}-${row.id}`} className="border-b border-[var(--portal-border)]">
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--portal-text-muted)]">
                          {format(new Date(row.at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </td>
                        <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                        <td className="px-3 py-2">{row.recipient ?? '—'}</td>
                        <td className="px-3 py-2 text-red-800">{row.error ?? row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => setTab('logs')}>
              Полный журнал
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <OutboundMailSettingsBlock
          description={
            <>
              Эти настройки задают общий транспорт для сайта и автоматических писем. Совпадают с блоком на странице{' '}
              <Link href="/portal/admin/settings" className="text-[var(--portal-accent)] underline">
                Настройки
              </Link>
              .
            </>
          }
        />
      )}

      {activeTab === 'mailboxes' && (
        <div className="space-y-4">
          <div className="portal-card p-4 text-sm text-[var(--portal-text-muted)]">
            Создайте ящик на домене <strong>@{props.mailDomain}</strong>, затем при необходимости синхронизируйте входящие в
            вкладке «Входящие».
          </div>
          <DomainMailboxesAdminClient
            initialItems={props.domainMailboxes}
            provisioningMode={props.provisioningMode}
            mailDomain={props.mailDomain}
          />
        </div>
      )}

      {activeTab === 'inbox' && (
        <div className="space-y-4">
          <div className="portal-card p-4 text-sm text-[var(--portal-text-muted)]">
            Импорт писем с IMAP в базу. Фоновый cron: GET /api/cron/inmail-sync — см. docs/Env-Config.md.
          </div>
          <InmailAdminClient initialRows={props.inmailRows} />
        </div>
      )}

      {activeTab === 'communications' && (
        <div className="portal-card p-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-semibold text-[var(--portal-text)]">Письма и сообщения</h3>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Разовые и шаблонные письма администратору и пользователям, история отправок <code className="text-xs">CommsSend</code>.
            Отличается от «Рассылок»: здесь точечные отправки, там кампании по базе.
          </p>
          <Link
            href="/portal/admin/communications"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'inline-flex items-center gap-2')}
          >
            Открыть раздел
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {activeTab === 'mailings' && (
        <div className="portal-card p-6 space-y-4 max-w-2xl">
          <h3 className="text-lg font-semibold text-[var(--portal-text)]">Рассылки</h3>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Кампании по списку получателей, журнал <code className="text-xs">MailingLog</code>. Использует общую доставку
            из вкладки «Доставка», если не задан отдельный отправитель в кампании.
          </p>
          <Link
            href="/portal/admin/mailings"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'inline-flex items-center gap-2')}
          >
            Открыть раздел
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="portal-card p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--portal-text)]">Журналы отправки</h3>
              <p className="text-sm text-[var(--portal-text-muted)]">
                Объединённый список: доставка сайта (<code className="text-xs">EmailDeliveryLog</code>), коммуникации (
                <code className="text-xs">CommsSend</code>), рассылки (<code className="text-xs">MailingLog</code>).
              </p>
            </div>
            <div className="w-full max-w-sm">
              <label htmlFor="mail-logs-filter" className="sr-only">
                Фильтр по получателю или ошибке
              </label>
              <Input
                id="mail-logs-filter"
                placeholder="Поиск по получателю, теме, ошибке…"
                value={logsFilter}
                onChange={(e) => setLogsFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--portal-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--portal-border)] bg-[#F8FAFC] text-left text-xs text-[var(--portal-text-muted)]">
                  <th className="px-3 py-2 font-medium">Когда</th>
                  <th className="px-3 py-2 font-medium">Источник</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium">Кому</th>
                  <th className="px-3 py-2 font-medium">Тема</th>
                  <th className="px-3 py-2 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--portal-text-muted)]">
                      Записей не найдено.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className="border-b border-[var(--portal-border)]">
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--portal-text-muted)]">
                        {format(new Date(row.at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </td>
                      <td className="px-3 py-2">{sourceLabel(row.source)}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.recipient ?? '—'}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{row.subject ?? '—'}</td>
                      <td className="px-3 py-2 text-red-800 max-w-xs truncate">{row.error ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
