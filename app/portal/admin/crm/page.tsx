/**
 * Admin: CRM — leads from leads table, funnel, convert to user.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CrmLeadsClient } from './CrmLeadsClient';
import { CrmFunnelChart } from './CrmFunnelChart';

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

  const byStatus = leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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
    created_at: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'CRM' },
        ]}
        title="CRM"
        description="Лиды, воронка, конвертация в пользователей"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm text-text-muted">{status}</p>
            <p className="text-2xl font-bold text-dark">{count}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Воронка лидов</h2>
        <CrmFunnelChart byStatus={byStatus} />
      </div>

      <CrmLeadsClient initialLeads={list} />
    </div>
  );
}
