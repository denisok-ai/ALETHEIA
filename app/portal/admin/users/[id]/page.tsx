/**
 * Admin: user detail — profile, enrollments, certificates, orders, tickets; tabs like course card.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { UserDetailTabs } from './UserDetailTabs';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const { id: userId } = await params;

  const [user, courses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        enrollments: { include: { course: { select: { id: true, title: true } } } },
        certificates: { include: { course: { select: { title: true } } } },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }),
    prisma.course.findMany({
      select: { id: true, title: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!user) notFound();

  const profile = user.profile;
  const displayName = profile?.displayName ?? user.displayName ?? user.email;
  const email = profile?.email ?? user.email;

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/users', label: 'Пользователи' },
          { label: String(displayName ?? '') },
        ]}
        title={String(displayName ?? 'Пользователь')}
        description={email ?? undefined}
        actions={
          <Link
            href="/portal/admin/users"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[#6366F1] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку пользователей
          </Link>
        }
      />

      <UserDetailTabs
        userId={user.id}
        initialRole={profile?.role ?? 'user'}
        initialStatus={profile?.status ?? 'active'}
        initialDisplayName={profile?.displayName ?? null}
        initialEmail={profile?.email ?? null}
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
        enrollments={user.enrollments.map((e) => ({
          id: e.id,
          courseId: e.courseId,
          courseTitle: e.course?.title ?? null,
          enrolledAt: e.enrolledAt.toISOString(),
        }))}
        certificates={user.certificates.map((c) => ({
          id: c.id,
          courseTitle: c.course?.title ?? null,
          certNumber: c.certNumber,
          issuedAt: c.issuedAt.toISOString(),
        }))}
        orders={user.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          amount: o.amount,
          status: o.status,
          paidAt: o.paidAt?.toISOString() ?? null,
          createdAt: o.createdAt.toISOString(),
        }))}
        tickets={user.tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
        }))}
      />
    </div>
  );
}
