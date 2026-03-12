/**
 * Manager: Phygital homework verification queue. Portal design.
 */
import { getServerSession } from 'next-auth';
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

  const items = await prisma.phygitalVerification.findMany({
    where: { status: 'pending' },
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
    lesson_id: i.lessonId,
    video_url: i.videoUrl,
    status: i.status,
    created_at: i.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Верификация заданий' }]}
        title="Верификация заданий"
        description="Очередь видео на проверку, одобрить / отклонить"
      />
      <VerificationsList items={list} profileMap={profileMap} />
    </div>
  );
}
