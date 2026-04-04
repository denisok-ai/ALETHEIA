'use client';

import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationSetsTableClient, type NotificationSetRow } from './NotificationSetsTableClient';
import { CreateNotificationSetButton } from './CreateNotificationSetButton';
import { Bell } from 'lucide-react';
import { PORTAL_PATH } from '@/lib/portal-paths';

export function AdminNotificationSetsCatalogView({ sets }: { sets: NotificationSetRow[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        items={[{ href: PORTAL_PATH.adminDashboard, label: 'Дашборд' }, { label: 'Наборы уведомлений' }]}
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
          <NotificationSetsTableClient sets={sets} />
        )}
      </Card>
    </div>
  );
}
