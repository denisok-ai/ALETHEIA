/**
 * Admin: карточка набора уведомлений — просмотр и редактирование параметров.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ArrowLeft } from 'lucide-react';
import { getNotificationSetEventLabel } from '@/lib/notification-set-events';
import { NotificationSetEditForm } from './NotificationSetEditForm';

export default async function AdminNotificationSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
      </div>
    );
  }

  const { id } = await params;
  const set = await prisma.notificationSet.findUnique({
    where: { id },
  });
  if (!set) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/notification-sets', label: 'Наборы уведомлений' },
          { label: set.name },
        ]}
        title={set.name}
        description={getNotificationSetEventLabel(set.eventType)}
        actions={
          <Link
            href="/portal/admin/notification-sets"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-dark hover:bg-bg-cream hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            К каталогу
          </Link>
        }
      />
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-sm text-text-muted">Тип события: <span className="font-medium text-dark">{getNotificationSetEventLabel(set.eventType)}</span></p>
      </div>
      <NotificationSetEditForm
        setId={id}
        initial={{
          name: set.name,
          isDefault: set.isDefault,
          isActive: set.isActive,
          templateId: set.templateId,
        }}
      />
    </div>
  );
}
