/**
 * Admin: CRM — leads from leads table, funnel, convert to user.
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

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const STATUS_ORDER = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
  const byStatus = leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const statusEntries = CRM_LEAD_STATUSES.map((status) => [status, byStatus[status] ?? 0] as const);

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

      <CrmLeadsClient initialLeads={list} />
    </div>
  );
}
