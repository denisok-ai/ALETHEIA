/**
 * Admin: журнал интеграции PayKeeper с фильтрами.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { PaykeeperLogsClient } from './PaykeeperLogsClient';

export const metadata: Metadata = { title: 'Логи PayKeeper' };

export default async function AdminPaykeeperLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <PageHeader items={[{ label: 'Логи PayKeeper' }]} title="Логи" description="Нет доступа." />;
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/paykeeper', label: 'PayKeeper' },
          { label: 'Логи' },
        ]}
        title="Логи PayKeeper"
        description="Фильтры по событию, статусу и номеру заказа. Секреты в payload не пишутся."
      />
      <PaykeeperLogsClient />
    </div>
  );
}
