/**
 * Manager: support tickets list. Portal design. Table with server-side pagination and sorting.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Тикеты' };

import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { ManagerTicketsTableClient } from './ManagerTicketsTableClient';

export default async function ManagerTicketsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== 'manager' && role !== 'admin')) notFound();
  return (
    <div className="w-full max-w-none space-y-6">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Тикеты' }]}
        title="Тикеты"
        description="Заявки поддержки"
      />
      <Suspense fallback={<p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>}>
        <ManagerTicketsTableClient />
      </Suspense>
    </div>
  );
}
