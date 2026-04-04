'use client';

import Link from 'next/link';
import { MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';

const STATUS_MAP: Record<string, string> = {
  open: 'badge-warn',
  in_progress: 'badge-info',
  resolved: 'badge-active',
  closed: 'badge-neutral',
};

/** На дашборде не показываем четырёхзначные числа целиком (тяжёлый seed) — точное значение в подсказке и aria. */
const STAT_DISPLAY_CAP = 999;

function formatStatForCard(n: number): string {
  return n > STAT_DISPLAY_CAP ? `${STAT_DISPLAY_CAP}+` : String(n);
}

export type ManagerRecentTicket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
};

export interface ManagerDashboardViewProps {
  openTickets: number;
  pendingVerifications: number;
  recentTickets: ManagerRecentTicket[];
}

export function ManagerDashboardView({
  openTickets,
  pendingVerifications,
  recentTickets,
}: ManagerDashboardViewProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ label: 'Дашборд' }]}
        title="Дашборд"
        description="Тикеты и верификация заданий"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/manager/tickets"
          className="portal-card flex items-center gap-4 p-5 hover:shadow-[var(--portal-shadow)] transition-shadow"
          title={
            openTickets > STAT_DISPLAY_CAP
              ? `Всего открытых и в работе: ${openTickets} (на карточке показано «${STAT_DISPLAY_CAP}+»)`
              : `Всего открытых и в работе: ${openTickets}`
          }
          aria-label={`Открытых и в работе: ${openTickets}. Перейти к списку тикетов`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]">
            <MessageSquare className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">Открытых тикетов</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--portal-text)]">
              {formatStatForCard(openTickets)}
            </p>
          </div>
          <span className="ml-auto text-[var(--portal-text-soft)]">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <Link
          href="/portal/manager/verifications"
          className="portal-card flex items-center gap-4 p-5 hover:shadow-[var(--portal-shadow)] transition-shadow"
          title={
            pendingVerifications > STAT_DISPLAY_CAP
              ? `Ожидают проверки: ${pendingVerifications} (на карточке показано «${STAT_DISPLAY_CAP}+»)`
              : `Ожидают проверки: ${pendingVerifications}`
          }
          aria-label={`На верификации (ожидают): ${pendingVerifications}. Перейти к верификациям`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1D4ED8]">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">На верификации</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--portal-text)]">
              {formatStatForCard(pendingVerifications)}
            </p>
          </div>
          <span className="ml-auto text-[var(--portal-text-soft)]">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>

      <section>
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-3">Последние тикеты</h2>
        {recentTickets.length === 0 ? (
          <div className="portal-card p-8 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">Нет тикетов</p>
            <Link
              href="/portal/manager/tickets"
              className="mt-3 inline-block text-sm font-medium text-[var(--portal-accent)] hover:underline"
            >
              Перейти к тикетам →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recentTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/portal/manager/tickets/${t.id}`}
                  className="portal-card flex items-center justify-between gap-4 p-4 hover:shadow-[var(--portal-shadow)] transition-shadow"
                  aria-label={`Открыть тикет: ${t.subject}`}
                >
                  <span className="font-medium text-[var(--portal-text)] truncate">{t.subject}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`status-badge ${STATUS_MAP[t.status] ?? 'badge-neutral'}`}>
                      {t.status === 'open'
                        ? 'Открыт'
                        : t.status === 'in_progress'
                          ? 'В работе'
                          : t.status === 'resolved'
                            ? 'Решён'
                            : 'Закрыт'}
                    </span>
                    <time className="text-xs text-[var(--portal-text-soft)]">
                      {new Date(t.createdAt).toLocaleString('ru', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <ArrowRight className="h-4 w-4 text-[var(--portal-text-soft)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {recentTickets.length > 0 && (
          <p className="mt-3">
            <Link href="/portal/manager/tickets" className="text-sm font-medium text-[var(--portal-accent)] hover:underline">
              Все тикеты →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
