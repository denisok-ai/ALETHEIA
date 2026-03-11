/**
 * Admin: mailing detail and results (logs).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { MailingDetailClient } from './MailingDetailClient';

export default async function AdminMailingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) notFound();

  const { id } = await params;
  const mailing = await prisma.mailing.findUnique({
    where: { id },
    include: {
      createdBy: { select: { email: true, profile: { select: { displayName: true } } } },
      logs: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!mailing) notFound();

  const logs = mailing.logs.map((l) => ({
    id: l.id,
    recipientEmail: l.recipientEmail,
    recipientName: l.recipientName,
    status: l.status,
    errorMessage: l.errorMessage,
    sentAt: l.sentAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  const sent = mailing.logs.filter((l) => l.status === 'sent').length;
  const failed = mailing.logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/mailings', label: 'Рассылки' },
          { label: mailing.internalTitle },
        ]}
        title={mailing.internalTitle}
        description={`Тема: ${mailing.emailSubject}. Статус: ${mailing.status === 'planned' ? 'Запланирована' : mailing.status === 'processing' ? 'Идёт' : 'Завершена'}.`}
      />
      <MailingDetailClient
        mailingId={mailing.id}
        status={mailing.status}
        startedAt={mailing.startedAt?.toISOString() ?? null}
        completedAt={mailing.completedAt?.toISOString() ?? null}
        sentCount={sent}
        failedCount={failed}
        initialLogs={logs}
      />
    </div>
  );
}
