/**
 * Admin: отчётность — сводка, по курсам, по слушателям, по периоду.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Отчёты' };

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
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Отчётность' },
        ]}
        title="Отчётность"
        description="Сводные отчёты и отчёты по курсам, слушателям и периоду. Экспорт в CSV и XLSX."
      />
      <ReportsClient />
    </div>
  );
}
