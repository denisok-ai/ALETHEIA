/**
 * Admin: создание шаблона уведомления.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { NotificationTemplateForm } from '../NotificationTemplateForm';

export default async function NewNotificationTemplatePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/notification-templates', label: 'Шаблоны уведомлений' },
          { label: 'Новый шаблон' },
        ]}
        title="Новый шаблон уведомления"
        description="Заполните название, тему (для email) и тело с плейсхолдерами."
      />
      <NotificationTemplateForm />
    </div>
  );
}
