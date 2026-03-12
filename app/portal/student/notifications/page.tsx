/**
 * Student: full list of notifications, mark as read. Portal design.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { NotificationsList } from './NotificationsList';

export default async function StudentNotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const initialItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    content: n.content,
    is_read: n.isRead,
    created_at: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Уведомления' }]}
        title="Уведомления"
        description="Все уведомления"
      />
      <NotificationsList initialItems={initialItems} />
    </div>
  );
}
