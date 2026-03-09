/**
 * Admin: payments — orders table, revenue stats, CSV export.
 */
import { createClient } from '@/lib/supabase/server';
import { PaymentsExportButton } from './PaymentsExportButton';

export default async function AdminPaymentsPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Оплаты</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, tariff_id, amount, client_email, status, paid_at, created_at')
    .order('created_at', { ascending: false });

  const list = orders ?? [];
  const paid = list.filter((o) => (o as { status: string }).status === 'paid');
  const totalRevenue = paid.reduce((sum, o) => sum + ((o as { amount: number }).amount ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-dark">Оплаты</h1>
          <p className="mt-1 text-text-muted">Транзакции и дашборд выручки</p>
        </div>
        <PaymentsExportButton />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Выручка (всего)</p>
          <p className="text-2xl font-bold text-dark">{totalRevenue.toLocaleString('ru')} ₽</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Оплаченных заказов</p>
          <p className="text-2xl font-bold text-dark">{paid.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Всего заказов</p>
          <p className="text-2xl font-bold text-dark">{list.length}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">№ заказа</th>
              <th className="px-4 py-3 font-medium text-dark">Тариф</th>
              <th className="px-4 py-3 font-medium text-dark">Сумма</th>
              <th className="px-4 py-3 font-medium text-dark">Email</th>
              <th className="px-4 py-3 font-medium text-dark">Статус</th>
              <th className="px-4 py-3 font-medium text-dark">Дата</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={(o as { id: number }).id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-3 font-mono text-sm text-dark">{(o as { order_number: string }).order_number}</td>
                <td className="px-4 py-3 text-text-muted">{(o as { tariff_id: string }).tariff_id}</td>
                <td className="px-4 py-3 font-medium text-dark">{(o as { amount: number }).amount} ₽</td>
                <td className="px-4 py-3 text-text-muted">{(o as { client_email: string }).client_email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      (o as { status: string }).status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {(o as { status: string }).status}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date((o as { created_at: string }).created_at).toLocaleString('ru')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет заказов.</p>
      )}
    </div>
  );
}
