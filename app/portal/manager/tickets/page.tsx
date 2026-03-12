/**
 * Manager: support tickets list. Portal design.
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { MessageSquare, ArrowRight } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Открыт',    cls: 'badge-warn' },
  in_progress: { label: 'В работе',  cls: 'badge-info' },
  resolved:    { label: 'Решён',     cls: 'badge-active' },
  closed:      { label: 'Закрыт',    cls: 'badge-neutral' },
};

export default async function ManagerTicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">База данных недоступна.</p>
      </div>
    );
  }

  const tickets = await prisma.ticket.findMany({
    include: {
      user: {
        include: { profile: { select: { displayName: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Тикеты' }]}
        title="Тикеты"
        description="Заявки поддержки"
      />

      {tickets.length === 0 ? (
        <div className="portal-card p-10 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Нет тикетов</h2>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Новые обращения появятся здесь.</p>
        </div>
      ) : (
        <div className="portal-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Дата</th>
                  <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Тема</th>
                  <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Пользователь</th>
                  <th className="px-4 py-3 font-semibold text-[var(--portal-text)]">Статус</th>
                  <th className="px-4 py-3 w-8" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const p = t.user.profile;
                  const name = p?.displayName ?? p?.email ?? t.user.email ?? t.userId.slice(0, 8);
                  const s = STATUS_MAP[t.status] ?? { label: t.status, cls: 'badge-neutral' };
                  return (
                    <tr key={t.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 text-[var(--portal-text-muted)]">
                        {new Date(t.createdAt).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--portal-text)]">
                        <Link href={`/portal/manager/tickets/${t.id}`} className="hover:text-[#6366F1] transition-colors">
                          {t.subject}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--portal-text-muted)]">{name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`status-badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/portal/manager/tickets/${t.id}`} className="text-[var(--portal-text-soft)] hover:text-[#6366F1]" aria-label="Открыть">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
