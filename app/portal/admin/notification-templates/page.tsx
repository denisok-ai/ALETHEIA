/**
 * Admin: каталог шаблонов уведомлений — список с переходом в создание/редактирование.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminNotificationTemplatesView } from './AdminNotificationTemplatesView';

export const metadata: Metadata = { title: 'Шаблоны уведомлений' };

export default async function AdminNotificationTemplatesPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const templates = await prisma.notificationTemplate.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, subject: true, type: true },
  });

  const templatesData = templates.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    type: t.type,
  }));

  return <AdminNotificationTemplatesView templates={templatesData} />;
}
