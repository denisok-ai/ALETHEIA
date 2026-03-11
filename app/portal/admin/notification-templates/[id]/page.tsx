/**
 * Admin: редактирование шаблона уведомления.
 */
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { NotificationTemplateForm } from '../NotificationTemplateForm';

export default async function EditNotificationTemplatePage({
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
  const template = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/notification-templates', label: 'Шаблоны уведомлений' },
          { label: template.name },
        ]}
        title={template.name}
        description="Редактирование шаблона уведомления"
      />
      <NotificationTemplateForm templateId={id} />
    </div>
  );
}
