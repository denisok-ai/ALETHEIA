/**
 * Admin: здоровье и диагностика PayKeeper.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { PaykeeperHealthClient } from './PaykeeperHealthClient';

export const metadata: Metadata = { title: 'PayKeeper — диагностика' };

export default async function AdminPaykeeperHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <PageHeader items={[{ label: 'PayKeeper' }]} title="PayKeeper" description="Нет доступа." />
    );
  }

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'PayKeeper' },
        ]}
        title="PayKeeper: здоровье"
        description="Проверка токена, списка платёжных систем и счётчика ошибок. Действия по заказам — в разделе «Оплаты» (карточка заказа)."
      />
      <div className="portal-card p-6">
        <PaykeeperHealthClient />
      </div>
    </div>
  );
}
