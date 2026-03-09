/**
 * Admin: CRM — leads from leads table, funnel, convert to user.
 */
import { createClient } from '@/lib/supabase/server';
import { CrmLeadsClient } from './CrmLeadsClient';
import { CrmFunnelChart } from './CrmFunnelChart';

export default async function AdminCrmPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">CRM</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, phone, email, message, status, converted_to_user_id, created_at')
    .order('created_at', { ascending: false });

  const list = leads ?? [];
  const byStatus = list.reduce(
    (acc, l) => {
      const s = (l as { status?: string }).status ?? 'new';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">CRM</h1>
      <p className="mt-1 text-text-muted">Лиды, воронка, конвертация в пользователей</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
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

      <CrmLeadsClient initialLeads={list as { id: number; name: string; phone: string; email: string | null; message: string | null; status: string; converted_to_user_id: string | null; created_at: string }[]} />
    </div>
  );
}
