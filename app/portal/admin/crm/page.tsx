/**
 * Admin: CRM — leads from leads table, funnel, convert to user, personal product sales.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'CRM' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CrmLeadsClient } from './CrmLeadsClient';
import { CrmFunnelChart } from './CrmFunnelChart';
import { CRM_LEAD_STATUSES } from '@/lib/crm-lead-status';

export default async function AdminCrmPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'CRM' }]} title="CRM" description="База данных недоступна." />
      </div>
    );
  }

  const [leads, paidLinks] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.paymentLink.findMany({
      where: { status: 'paid' },
      orderBy: { paidAt: 'desc' },
      include: { product: { select: { name: true, priceRub: true } } },
      take: 50,
    }),
  ]);

  const STATUS_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
  const byStatus = leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const statusEntries = CRM_LEAD_STATUSES.map((status) => [status, byStatus[status] ?? 0] as const);

  const personalRevenue = paidLinks.reduce((s, l) => s + (l.product?.priceRub ?? 0), 0);

  const list = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    message: l.message,
    notes: l.notes,
    status: l.status,
    source: l.source,
    converted_to_user_id: l.convertedToUserId,
    last_order_number: l.lastOrderNumber ?? null,
    created_at: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'CRM' },
        ]}
        title="CRM"
        description="Лиды, воронка, конвертация в пользователей"
      />

      <div className="grid grid-cols-5 gap-4 min-w-0">
        {statusEntries.map(([status, count]) => (
          <div key={status} className="portal-card p-5">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">{status}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--portal-text)]">{count}</p>
          </div>
        ))}
      </div>

      <div className="portal-card min-w-0 p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Воронка лидов</h2>
        <CrmFunnelChart byStatus={byStatus} />
      </div>

      {paidLinks.length > 0 && (
        <div className="portal-card min-w-0 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--portal-text)]">Персональные продажи</h2>
            <span className="text-sm text-[var(--portal-text-muted)]">
              {paidLinks.length} оплат · {personalRevenue.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--portal-text-muted)]">Товар</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--portal-text-muted)]">Клиент</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--portal-text-muted)]">Сумма</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--portal-text-muted)]">Дата оплаты</th>
                </tr>
              </thead>
              <tbody>
                {paidLinks.map((link) => (
                  <tr key={link.id} className="border-b border-[var(--border)] hover:bg-[var(--portal-accent-soft)]">
                    <td className="py-2.5 px-3 font-medium text-[var(--portal-text)]">
                      {link.product?.name ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--portal-text-muted)]">
                      {link.clientName || link.clientEmail || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium text-[var(--portal-text)]">
                      {(link.product?.priceRub ?? 0).toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="py-2.5 px-3 text-[var(--portal-text-muted)]">
                      {link.paidAt ? new Date(link.paidAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CrmLeadsClient initialLeads={list} />
    </div>
  );
}
