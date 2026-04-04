'use client';

import Link from 'next/link';
import { LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  NotificationTemplatesTableClient,
  type NotifTemplateRow,
} from './NotificationTemplatesTableClient';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PortalAccentAddLink } from '@/components/portal/PortalAccentAddLink';
import { PORTAL_PATH } from '@/lib/portal-paths';

export function AdminNotificationTemplatesView({ templates }: { templates: NotifTemplateRow[] }) {
  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[{ href: PORTAL_PATH.adminDashboard, label: 'Дашборд' }, { label: 'Шаблоны уведомлений' }]}
        title="Шаблоны уведомлений"
        description="Шаблоны тем и текстов для системных уведомлений (запись на курс, сертификат и т.д.). Плейсхолдеры: %recfirstname%, %reclastname%, %date%, %systemtitle%, %objectname%."
        actions={<PortalAccentAddLink href="/portal/admin/notification-templates/new">Добавить шаблон</PortalAccentAddLink>}
      />
      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Нет шаблонов"
            description="Создайте шаблон для использования в наборах уведомлений."
            icon={<LayoutTemplate className="h-10 w-10" />}
            action={
              <Link href="/portal/admin/notification-templates/new" className={cn(buttonVariants())}>
                Добавить шаблон
              </Link>
            }
          />
        ) : (
          <NotificationTemplatesTableClient templates={templates} />
        )}
      </Card>
    </div>
  );
}
