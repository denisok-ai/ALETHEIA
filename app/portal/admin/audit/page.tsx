/**
 * Admin: audit log — filters (action, entity, actor, date), search.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { AuditLogClient } from './AuditLogClient';

export default async function AdminAuditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Журнал аудита' }]} title="Журнал аудита" description="База данных недоступна." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Журнал аудита' },
        ]}
        title="Журнал аудита"
        description="Кто что изменил или удалил"
      />
      <Card title="Журнал записей">
        <AuditLogClient />
      </Card>
    </div>
  );
}
