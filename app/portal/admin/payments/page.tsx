/**
 * Admin: payments — orders table with filters, search, pagination, manual confirm; revenue stats, CSV export.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { PaymentsExportButton } from './PaymentsExportButton';
import { PaymentsTableClient } from './PaymentsTableClient';
import { ServicesAdminBlock } from './ServicesAdminBlock';

export default async function AdminPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Оплаты' }]} title="Оплаты" description="База данных недоступна." />
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const paid = orders.filter((o) => o.status === 'paid');
  const totalRevenue = paid.reduce((sum, o) => sum + o.amount, 0);

  const initialOrders = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tariffId: o.tariffId,
    amount: o.amount,
    clientEmail: o.clientEmail,
    status: o.status,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    userId: o.userId ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Оплаты' },
        ]}
        title="Оплаты"
        description="Транзакции и дашборд выручки"
        actions={<PaymentsExportButton />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
          <p className="text-2xl font-bold text-dark">{orders.length}</p>
        </div>
      </div>

      <ServicesAdminBlock />

      <div>
        <PaymentsTableClient initialOrders={initialOrders} />
      </div>
    </div>
  );
}
