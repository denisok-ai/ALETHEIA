/**
 * Админ: журнал заявок на верификацию — та же таблица, что у менеджера.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Верификация заданий' };

import { authOptions } from '@/lib/auth';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { PageHeader } from '@/components/portal/PageHeader';
import { VerificationsTableClient } from '@/app/portal/manager/verifications/VerificationsTableClient';

export default async function AdminVerificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?redirect=/portal/admin/verifications');
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== 'admin') notFound();

  const viewerUserId = (session.user as { id?: string })?.id ?? '';
  const gamification = await getGamificationNumbers();

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/admin/dashboard', label: 'Дашборд' }, { label: 'Верификация заданий' }]}
        title="Верификация заданий"
        description={
          gamification.xpVerificationApproved > 0
            ? `Журнал заявок (видео и текст): фильтры, пагинация, аудит решений. При одобрении — до +${gamification.xpVerificationApproved} к заряду слушателя.`
            : 'Журнал заявок на проверку: все статусы и типы, фильтры и пагинация. Решения фиксируются в журнале аудита.'
        }
      />
      <VerificationsTableClient
        viewerUserId={viewerUserId}
        userHrefPrefix="/portal/admin/users"
        verificationsBasePath="/portal/admin/verifications"
      />
    </div>
  );
}
