/**
 * Student: full list of notifications, mark as read. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Уведомления' };

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

  // Лимит обязателен: без него на страницу уходила ВСЯ история уведомлений с
  // момента регистрации — у активного студента за пару лет это тысячи записей
  // в ответе на каждое открытие раздела. Соседние экраны сделаны так же
  // (дашборд берёт 4, карточка пользователя в админке — 25).
  const NOTIFICATIONS_LIMIT = 50;
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: NOTIFICATIONS_LIMIT,
  });

  const initialItems = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    content: n.content,
    is_read: n.isRead,
    created_at: n.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-4">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Уведомления' }]}
        title="Уведомления"
        description="Все уведомления"
      />
      <NotificationsList initialItems={initialItems} truncated={notifications.length === NOTIFICATIONS_LIMIT} />
    </div>
  );
}
