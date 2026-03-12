/**
 * Admin: communications — CRUD шаблонов, отправка (Resend/Telegram), история.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CommunicationsClient } from './CommunicationsClient';

export default async function AdminCommunicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Коммуникации' }]} title="Коммуникации" description="База данных недоступна." />
      </div>
    );
  }

  const [templates, recentSends] = await Promise.all([
    prisma.commsTemplate.findMany({ orderBy: { name: 'asc' } }),
    prisma.commsSend.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50,
    }),
  ]);

  const initialTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    channel: t.channel,
    subject: t.subject,
    htmlBody: t.htmlBody,
    variables: t.variables,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const initialSends = recentSends.map((s) => ({
    id: s.id,
    channel: s.channel,
    recipient: s.recipient,
    subject: s.subject,
    status: s.status,
    sentAt: s.sentAt.toISOString(),
  }));

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Коммуникации' },
        ]}
        title="Коммуникации"
        description="Рассылки, шаблоны, Resend и Telegram"
      />
      <CommunicationsClient initialTemplates={initialTemplates} initialSends={initialSends} />
    </div>
  );
}
