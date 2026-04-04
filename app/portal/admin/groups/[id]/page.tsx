/**
 * Admin: group detail — name, description, composition (courses/media/users), add/remove.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalBackLink } from '@/components/portal/PortalBackLink';
import { GroupDetailClient } from './GroupDetailClient';

const moduleTypeLabel: Record<string, string> = {
  course: 'Курсы',
  media: 'Медиатека',
  user: 'Пользователи',
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!group) return { title: 'Группа' };
  return { title: group.name.slice(0, 60) };
}

export default async function AdminGroupDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: {
        select: { id: true, name: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      },
      _count: { select: { children: true, courseGroups: true, mediaGroups: true, userGroups: true } },
    },
  });

  if (!group) notFound();

  const listHref =
    group.moduleType === 'course'
      ? '/portal/admin/courses'
      : group.moduleType === 'media'
        ? '/portal/admin/media'
        : '/portal/admin/users';

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: listHref, label: moduleTypeLabel[group.moduleType] ?? 'Группы' },
          { label: group.name },
        ]}
        title={group.name}
        description={group.description ?? undefined}
        actions={
          <PortalBackLink href={listHref} className="bg-white">
            К списку
          </PortalBackLink>
        }
      />

      <GroupDetailClient
        group={{
          id: group.id,
          name: group.name,
          description: group.description,
          parentId: group.parentId,
          parent: group.parent,
          children: group.children,
          moduleType: group.moduleType,
          type: group.type,
          accessType: group.accessType,
          displayOrder: group.displayOrder,
          childrenCount: group._count.children,
          coursesCount: group._count.courseGroups,
          mediaCount: group._count.mediaGroups,
          usersCount: group._count.userGroups,
        }}
      />
    </div>
  );
}
