/**
 * Student: profile — view and edit displayName. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Профиль' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ProfileEditForm } from './ProfileEditForm';

export default async function StudentProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6 max-w-xl">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { displayName: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  ]);
  const email = profile?.email ?? user?.email ?? null;
  const displayName = profile?.displayName ?? null;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Профиль' }]}
        title="Профиль"
        description="Ваши данные и настройки отображения"
      />
      <ProfileEditForm initialDisplayName={displayName} email={email} />
    </div>
  );
}
