/**
 * Admin: user catalog (active/archived). TanStack Table + filter.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { type UserRow } from '@/components/portal/UsersTable';
import { AddUserDialog } from './AddUserDialog';
import { UsersPageWithGroups } from './UsersPageWithGroups';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Пользователи' }]} title="Пользователи" description="Загрузка…" />
      </div>
    );
  }

  const profiles = await prisma.profile.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const rows: UserRow[] = profiles.map((p) => ({
    id: p.userId,
    email: p.email ?? p.user.email ?? null,
    role: p.role,
    status: p.status,
    display_name: p.displayName ?? null,
    created_at: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Пользователи' },
        ]}
        title="Пользователи"
        description="Каталог пользователей портала: роли, статусы, редактирование"
        actions={<AddUserDialog />}
      />
      <UsersPageWithGroups initialRows={rows} />
    </div>
  );
}
