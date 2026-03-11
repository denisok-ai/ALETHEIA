/**
 * Manager: user search by email/name (read-only).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { ManagerUserSearch } from './ManagerUserSearch';

export default async function ManagerUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Пользователи</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
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
    <div>
      <Breadcrumbs items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Пользователи' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Пользователи</h1>
      <p className="mt-1 text-text-muted">Поиск и просмотр карточки студента</p>
      <ManagerUserSearch initialProfiles={initialProfiles} />
    </div>
  );
}
