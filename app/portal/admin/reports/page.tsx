/**
 * Admin: отчётность — сводка, по курсам, по слушателям, по периоду.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { ReportsClient } from './ReportsClient';

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Отчётность' }]} title="Отчётность" description="Требуется авторизация." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Отчётность' },
        ]}
        title="Отчётность"
        description="Сводные отчёты и отчёты по курсам, слушателям и периоду. Экспорт в CSV."
      />
      <ReportsClient />
    </div>
  );
}
