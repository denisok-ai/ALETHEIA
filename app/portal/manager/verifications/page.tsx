/**
 * Manager: журнал заявок на верификацию — таблица, фильтры, пагинация.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Верификация заданий' };

import { authOptions } from '@/lib/auth';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { PageHeader } from '@/components/portal/PageHeader';
import { VerificationsTableClient } from './VerificationsTableClient';

export default async function ManagerVerificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">База данных недоступна.</p>
      </div>
    );
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== 'manager' && role !== 'admin') notFound();

  const viewerUserId = (session.user as { id?: string })?.id ?? '';
  const gamification = await getGamificationNumbers();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Верификация заданий' }]}
        title="Верификация заданий"
        description={
          gamification.xpVerificationApproved > 0
            ? `Журнал заявок (видео и текст): фильтры по статусу и типу, решения фиксируются в аудите. При одобрении слушатель может получить +${gamification.xpVerificationApproved} к заряду.`
            : 'Журнал заявок на проверку: все статусы, фильтры и пагинация. Решения проверяющего пишутся в журнал аудита.'
        }
      />
      <VerificationsTableClient
        viewerUserId={viewerUserId}
        userHrefPrefix={role === 'admin' ? '/portal/admin/users' : '/portal/manager/users'}
        verificationsBasePath="/portal/manager/verifications"
      />
    </div>
  );
}
