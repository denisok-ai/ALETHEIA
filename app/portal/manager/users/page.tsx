/**
 * Manager: user search by email/name (read-only). Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Пользователи' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ManagerUserSearch } from './ManagerUserSearch';

export default async function ManagerUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">База данных недоступна.</p>
      </div>
    );
  }

  const profiles = await prisma.profile.findMany({
    where: { role: 'user' },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const initialProfiles = profiles.map((p) => ({
    id: p.userId,
    display_name: p.displayName,
    email: p.email ?? p.user.email,
    role: p.role,
    status: p.status,
    created_at: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Пользователи' }]}
        title="Пользователи"
        description="Поиск и просмотр карточки студента"
      />
      <ManagerUserSearch initialProfiles={initialProfiles} />
    </div>
  );
}
