/**
 * Admin: notification log (who received what, when).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { NotificationLogsClient } from './NotificationLogsClient';

export default async function AdminNotificationLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Журнал уведомлений' }]} title="Журнал уведомлений" description="Требуется авторизация." />
      </div>
    );
  }

  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });

  const initialLogs = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    userEmail: l.user?.email ?? null,
    userDisplayName: l.user?.profile?.displayName ?? null,
    eventType: l.eventType,
    subject: l.subject,
    content: l.content,
    channel: l.channel,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Журнал уведомлений' },
        ]}
        title="Журнал уведомлений"
        description="Отправленные уведомления (лента и email)"
      />
      <NotificationLogsClient initialLogs={initialLogs} />
    </div>
  );
}
