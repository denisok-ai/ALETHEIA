/**
 * Student: full list of notifications, mark as read.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { NotificationsList } from './NotificationsList';

export default async function StudentNotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Уведомления</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
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
    <div>
      <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Уведомления' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Уведомления</h1>
      <p className="mt-1 text-text-muted">Все уведомления</p>
      <NotificationsList initialItems={initialItems} />
    </div>
  );
}
