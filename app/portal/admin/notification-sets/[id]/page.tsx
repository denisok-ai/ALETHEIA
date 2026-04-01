/**
 * Admin: карточка набора уведомлений — просмотр и редактирование параметров.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ArrowLeft } from 'lucide-react';
import { getNotificationSetEventLabel } from '@/lib/notification-set-events';
import { NotificationSetEditForm } from './NotificationSetEditForm';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const set = await prisma.notificationSet.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!set) return { title: 'Набор уведомлений' };
  return { title: set.name.slice(0, 60) };
}

export default async function AdminNotificationSetPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
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
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[var(--portal-accent)]"
          >
            <ArrowLeft className="h-4 w-4" />
            К каталогу
          </Link>
        }
      />
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <p className="text-sm text-[var(--portal-text-muted)]">Тип события: <span className="font-medium text-[var(--portal-text)]">{getNotificationSetEventLabel(set.eventType)}</span></p>
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
