/**
 * Manager: support tickets — list with link to thread.
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';

export default async function ManagerTicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Тикеты</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
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
    <div>
      <Breadcrumbs items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Тикеты' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Тикеты</h1>
      <p className="mt-1 text-text-muted">Заявки поддержки</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-2 font-medium text-dark">Дата</th>
              <th className="px-4 py-2 font-medium text-dark">Тема</th>
              <th className="px-4 py-2 font-medium text-dark">Пользователь</th>
              <th className="px-4 py-2 font-medium text-dark">Статус</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const p = t.user.profile;
              const name = p?.displayName ?? p?.email ?? t.user.email ?? t.userId.slice(0, 8);
              return (
                <tr key={t.id} className="border-b border-border hover:bg-bg-cream">
                  <td className="px-4 py-2 text-text-muted">
                    {new Date(t.createdAt).toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-2 font-medium text-dark">
                    <Link href={`/portal/manager/tickets/${t.id}`} className="text-primary hover:underline">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        t.status === 'open'
                          ? 'bg-amber-100 text-amber-800'
                          : t.status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tickets.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет тикетов.</p>
      )}
    </div>
  );
}
