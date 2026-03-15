/**
 * Manager: support tickets list. Portal design. Table with server-side pagination and sorting.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Тикеты' };

import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { ManagerTicketsTableClient } from './ManagerTicketsTableClient';

export default async function ManagerTicketsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== 'manager' && role !== 'admin')) notFound();
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Тикеты' }]}
        title="Тикеты"
        description="Заявки поддержки"
      />
      <ManagerTicketsTableClient />
    </div>
  );
}
