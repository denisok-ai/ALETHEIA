/**
 * Student dashboard — данные на сервере, разметка с lucide в клиентском StudentDashboardView (Turbopack + RSC).
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  getEarnedBadges,
  getNextBadge,
  levelFromTotalXp,
  xpProgressPercentInCurrentLevel,
} from '@/lib/gamification';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { isLiveEventCourse } from '@/lib/course-format';
import { StudentDashboardView } from './StudentDashboardView';

export const metadata: Metadata = { title: 'Дашборд' };

function totalLessons(manifest: string | null): number {
  if (!manifest) return 1;
  try {
    const p = JSON.parse(manifest) as { items?: unknown[] };
    return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
  } catch {
    return 1;
  }
}

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  const staffStudentPreview = role === 'manager' || role === 'admin';

  if (!userId) {
    return (
      <div className="portal-card p-6">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const [enrollments, notifications, energy, progressByCourse, completedByCourse, certCount, gamification] =
    await Promise.all([
      prisma.enrollment.findMany({
        where: { userId, course: { status: 'published' } },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailUrl: true,
              scormManifest: true,
              courseFormat: true,
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        take: 6,
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.userEnergy.findUnique({ where: { userId } }),
      prisma.scormProgress.groupBy({
        by: ['courseId'],
        where: { userId },
        _count: { lessonId: true },
        _sum: { timeSpent: true },
      }),
      prisma.scormProgress.groupBy({
        by: ['courseId'],
        where: { userId, completionStatus: { in: ['completed', 'passed'] } },
        _count: { lessonId: true },
      }),
      prisma.certificate.count({ where: { userId, revokedAt: null } }),
      getGamificationNumbers(),
    ]);

  const displayName =
    (session?.user as { name?: string })?.name ||
    (session?.user as { email?: string })?.email?.split('@')[0] ||
    'Слушатель';

  const xp = energy?.xp ?? 0;
  const { xpPerLevel, xpLessonComplete } = gamification;
  const level = levelFromTotalXp(xp, xpPerLevel);
  const xpProgress = xpProgressPercentInCurrentLevel(xp, xpPerLevel);
  const totalTimeMin = Math.round(
    progressByCourse.reduce((acc, p) => acc + (p._sum.timeSpent ?? 0), 0) / 60
  );
  const completedCourses = enrollments.filter((e) => {
    if (!e.course) return false;
    const total = totalLessons(e.course.scormManifest);
    const done = completedByCourse.find((x) => x.courseId === e.course!.id)?._count.lessonId ?? 0;
    return done >= total && total > 0;
  }).length;

  const earnedBadges = getEarnedBadges(xp);
  const nextBadge = getNextBadge(xp);
  const xpProgressForGauge = xpProgress;
  const chargePercent = Math.min(100, Math.max(0, Math.round(xpProgress)));
  const pointsToNextBadge = nextBadge ? Math.max(0, nextBadge.minXp - xp) : 0;

  const courses = enrollments
    .map((e, idx) => {
      const c = e.course;
      if (!c) return null;
      const total = totalLessons(c.scormManifest);
      const completed = completedByCourse.find((x) => x.courseId === c.id)?._count.lessonId ?? 0;
      const timeSec = progressByCourse.find((x) => x.courseId === c.id)?._sum.timeSpent ?? 0;
      const hasScorm = !!(c.scormManifest?.trim());
      const live = isLiveEventCourse(c.courseFormat);
      const liveNoScorm = live && !hasScorm;
      const detailHref = `/portal/student/courses/${c.id}`;
      return {
        enrollmentId: e.id,
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        totalLessons: total,
        completedLessons: completed,
        timeSpentMin: Math.round(timeSec / 60),
        index: idx,
        formatBadge: live ? ('Мероприятие' as const) : null,
        hideLessonProgress: liveNoScorm,
        playHref: liveNoScorm ? detailHref : undefined,
        primaryCtaLabel: liveNoScorm ? 'Подробности' : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const notificationsSerialized = notifications.map((n) => ({
    id: n.id,
    content: n.content,
    type: n.type,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <StudentDashboardView
      displayName={displayName}
      xpLessonComplete={xpLessonComplete}
      xpPerLevel={xpPerLevel}
      level={level}
      chargePercent={chargePercent}
      pointsToNextBadge={pointsToNextBadge}
      xpProgress={xpProgressForGauge}
      earnedBadges={earnedBadges}
      enrollmentsCount={enrollments.length}
      completedCourses={completedCourses}
      certCount={certCount}
      totalTimeMin={totalTimeMin}
      courses={courses}
      notifications={notificationsSerialized}
      staffStudentPreview={staffStudentPreview}
    />
  );
}
