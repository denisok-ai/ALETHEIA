/**
 * Admin: каталог шаблонов уведомлений — список с переходом в создание/редактирование.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Шаблоны уведомлений' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationTemplatesTableClient } from './NotificationTemplatesTableClient';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, Plus } from 'lucide-react';

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

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Шаблоны уведомлений' },
        ]}
        title="Шаблоны уведомлений"
        description="Шаблоны тем и текстов для системных уведомлений (запись на курс, сертификат и т.д.). Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%."
        actions={
          <Link
            href="/portal/admin/notification-templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal-accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--portal-accent-dark)] shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Добавить шаблон
          </Link>
        }
      />
      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Нет шаблонов"
            description="Создайте шаблон для использования в наборах уведомлений."
            icon={<LayoutTemplate className="h-10 w-10" />}
            action={
              <Link href="/portal/admin/notification-templates/new">
                <Button>Добавить шаблон</Button>
              </Link>
            }
          />
        ) : (
          <NotificationTemplatesTableClient templates={templatesData} />
        )}
      </Card>
    </div>
  );
}
