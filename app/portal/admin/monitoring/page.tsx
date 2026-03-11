/**
 * Admin: мониторинг — пользователи онлайн, посещения, график.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { MonitoringClient } from './MonitoringClient';

export default async function AdminMonitoringPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Мониторинг' }]} title="Мониторинг" description="Требуется авторизация." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Мониторинг' },
        ]}
        title="Мониторинг"
        description="Пользователи онлайн, история посещений и график уникальных посетителей по дням."
      />
      <MonitoringClient />
    </div>
  );
}
