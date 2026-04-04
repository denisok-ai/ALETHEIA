/**
 * Admin: каталог наборов уведомлений — список с переходом в карточку набора.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminNotificationSetsCatalogView } from './AdminNotificationSetsCatalogView';

export const metadata: Metadata = { title: 'Наборы уведомлений' };

export default async function AdminNotificationSetsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const sets = await prisma.notificationSet.findMany({
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }],
    select: { id: true, eventType: true, name: true, isDefault: true },
  });

  const setsData = sets.map((s) => ({
    id: s.id,
    eventType: s.eventType,
    name: s.name,
    isDefault: s.isDefault,
  }));

  return <AdminNotificationSetsCatalogView sets={setsData} />;
}
