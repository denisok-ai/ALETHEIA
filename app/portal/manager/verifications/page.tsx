/**
 * Manager: Phygital homework verification queue. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Верификация заданий' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { VerificationsList } from './VerificationsList';

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

  const items = await prisma.phygitalVerification.findMany({
    where: { status: 'pending' },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const userIds = Array.from(new Set(items.map((i) => i.userId)));
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true, email: true },
  });
  const profileMap: Record<string, { display_name?: string; email?: string }> = {};
  for (const p of profiles) {
    profileMap[p.userId] = { display_name: p.displayName ?? undefined, email: p.email ?? undefined };
  }

  const list = items.map((i) => ({
    id: i.id,
    user_id: i.userId,
    course_id: i.courseId,
    course_title: i.course?.title ?? '',
    lesson_id: i.lessonId,
    assignment_type: i.assignmentType ?? 'video',
    video_url: i.videoUrl,
    status: i.status,
    created_at: i.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Верификация заданий' }]}
        title="Верификация заданий"
        description="Очередь заданий на проверку (видео и текст), одобрить / отклонить"
      />
      <VerificationsList
        items={list}
        profileMap={profileMap}
        userHrefPrefix={role === 'admin' ? '/portal/admin/users' : '/portal/manager/users'}
      />
    </div>
  );
}
