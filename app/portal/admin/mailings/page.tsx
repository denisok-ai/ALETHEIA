/**
 * Admin: mailings catalog.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { MailingsAdminClient } from './MailingsAdminClient';
import { UnsubscribedBlock } from './UnsubscribedBlock';

export default async function AdminMailingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Рассылки' }]} title="Рассылки" description="Требуется авторизация." />
      </div>
    );
  }

  const list = await prisma.mailing.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { email: true, profile: { select: { displayName: true } } } },
      _count: { select: { logs: true } },
    },
  });

  const initialMailings = list.map((m) => ({
    id: m.id,
    internalTitle: m.internalTitle,
    emailSubject: m.emailSubject,
    status: m.status,
    scheduleMode: m.scheduleMode,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    createdByEmail: m.createdBy?.email ?? null,
    createdByDisplayName: m.createdBy?.profile?.displayName ?? null,
    createdAt: m.createdAt.toISOString(),
    logsCount: m._count.logs,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Рассылки' },
        ]}
        title="Рассылки"
        description="Массовые email-рассылки: создание, отправка, журнал по получателям"
      />
      <MailingsAdminClient initialMailings={initialMailings} />
      <UnsubscribedBlock />
    </div>
  );
}
