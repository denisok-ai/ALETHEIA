/**
 * Manager: Phygital homework verification queue — approve/reject.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { VerificationsList } from './VerificationsList';

export default async function ManagerVerificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Верификация заданий</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
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
    <div>
      <Breadcrumbs items={[{ href: '/portal/manager/dashboard', label: 'Дашборд' }, { label: 'Верификация заданий' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Верификация заданий</h1>
      <p className="mt-1 text-text-muted">Очередь видео на проверку, одобрить / отклонить</p>
      <VerificationsList items={list} profileMap={profileMap} />
    </div>
  );
}
