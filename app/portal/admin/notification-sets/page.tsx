/**
 * Admin: каталог наборов уведомлений — список с переходом в карточку набора.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Наборы уведомлений' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationSetsTableClient } from './NotificationSetsTableClient';
import { CreateNotificationSetButton } from './CreateNotificationSetButton';
import { Bell } from 'lucide-react';

export default async function AdminNotificationSetsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const sets = await prisma.notificationSet.findMany({
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }],
    select: { id: true, eventType: true, name: true, isDefault: true },
  });

  const setsData = sets.map((s) => ({
    id: s.id,
    eventType: s.eventType,
    name: s.name,
    isDefault: s.isDefault,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Наборы уведомлений' },
        ]}
        title="Наборы уведомлений"
        description="Каталог наборов для прикрепления к мероприятиям"
        actions={<CreateNotificationSetButton />}
      />
      <Card title="Каталог" description="Наборы, отмеченные «По умолчанию», автоматически прикрепляются к новым курсам.">
        {sets.length === 0 ? (
          <EmptyState
            title="Нет наборов уведомлений"
            description="Создайте первый набор с помощью кнопки «Создать набор» выше"
            icon={<Bell className="h-10 w-10" />}
          />
        ) : (
          <NotificationSetsTableClient sets={setsData} />
        )}
      </Card>
    </div>
  );
}
