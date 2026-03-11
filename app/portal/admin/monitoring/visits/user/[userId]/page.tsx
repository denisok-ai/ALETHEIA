/**
 * Admin: детализация посещений по пользователю — список сессий (IP, вход, выход).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { VisitDetailClient } from './VisitDetailClient';

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Мониторинг' }]} title="Посещения" description="Требуется авторизация." />
      </div>
    );
  }

  const { userId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/monitoring', label: 'Мониторинг' },
          { label: 'Посещения пользователя' },
        ]}
        title="Время посещения"
        description="Список сессий пользователя за период."
      />
      <VisitDetailClient userId={userId} />
    </div>
  );
}
