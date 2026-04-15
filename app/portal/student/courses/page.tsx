/**
 * Student: enrolled courses — new design with CourseCard grid.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Мои курсы' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CourseCard } from '@/components/portal/CourseCard';
import { isLiveEventCourse } from '@/lib/course-format';
import { StudentCoursesEmptyState } from './StudentCoursesEmptyState';

function totalLessons(manifest: string | null): number {
  if (!manifest) return 1;
  try {
    const p = JSON.parse(manifest) as { items?: unknown[] };
    return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
  } catch { return 1; }
}

export default async function StudentCoursesPage() {
  const session  = await getServerSession(authOptions);
  const userId   = (session?.user as { id?: string })?.id;
  const role     = (session?.user as { role?: string })?.role;
  const isAdmin  = role === 'admin';

  if (!userId) {
    return (
      <div className="portal-card p-6">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { status: 'published' } },
    include: {
      course: {
        select: { id: true, title: true, description: true, thumbnailUrl: true, scormManifest: true, courseFormat: true },
      },
    },
    orderBy: { enrolledAt: 'desc' },
    take: 500,
  });

  type CourseItem = {
    enrollId: string;
    course: {
      id: string;
      title: string;
      description: string | null;
      thumbnailUrl: string | null;
      scormManifest: string | null;
      courseFormat: string;
    };
    accessClosed?: boolean;
  };

  let list: CourseItem[];

  if (isAdmin) {
    const allCourses = await prisma.course.findMany({
      where: { status: 'published' },
      select: { id: true, title: true, description: true, thumbnailUrl: true, scormManifest: true, courseFormat: true },
      orderBy: { sortOrder: 'asc' },
      take: 500,
    });
    list = allCourses.map((c) => ({ enrollId: `admin-${c.id}`, course: c }));
  } else {
    list = enrollments.map((e) => ({
      enrollId: e.id,
      course: e.course!,
      accessClosed: e.accessClosed,
    }));
  }

  const progressByCourse = await prisma.scormProgress.groupBy({
    by: ['courseId'],
    where: { userId },
    _count: { lessonId: true },
    _sum: { timeSpent: true },
    _avg: { score: true },
  });
  const completedByCourse = await prisma.scormProgress.groupBy({
    by: ['courseId'],
    where: { userId, completionStatus: { in: ['completed', 'passed'] } },
    _count: { lessonId: true },
  });

  const completedCount  = list.filter((e) => {
    const total = totalLessons(e.course.scormManifest);
    const done  = completedByCourse.find((x) => x.courseId === e.course.id)?._count.lessonId ?? 0;
    return done >= total && total > 0;
  }).length;
  const inProgressCount = list.filter((e) => {
    const done = completedByCourse.find((x) => x.courseId === e.course.id)?._count.lessonId ?? 0;
    const total = totalLessons(e.course.scormManifest);
    const started = (progressByCourse.find((x) => x.courseId === e.course.id)?._count.lessonId ?? 0) > 0;
    return started && done < total;
  }).length;

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--portal-text)]">
            {isAdmin ? 'Все курсы' : 'Мои курсы'}
          </h1>
          <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
            {isAdmin
              ? 'Полный доступ как администратор'
              : `${list.length} записей · ${completedCount} завершено · ${inProgressCount} в процессе`}
          </p>
        </div>

        {/* Мини-фильтр (статические кнопки для визуала — можно расширить) */}
        {!isAdmin && list.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="status-badge badge-info">{inProgressCount} в процессе</span>
            <span className="status-badge badge-active">{completedCount} завершено</span>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <StudentCoursesEmptyState isAdmin={isAdmin} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e, idx) => {
            const c       = e.course;
            const total   = totalLessons(c.scormManifest);
            const done    = completedByCourse.find((x) => x.courseId === c.id)?._count.lessonId ?? 0;
            const prog    = progressByCourse.find((x) => x.courseId === c.id);
            const timeSec = prog?._sum.timeSpent ?? 0;
            const avgScore = prog?._avg?.score != null ? Math.round(prog._avg.score) : undefined;
            const hasScorm = !!(c.scormManifest?.trim());
            const live     = isLiveEventCourse(c.courseFormat);
            const liveNoScorm = live && !hasScorm;
            const detailHref = `/portal/student/courses/${c.id}`;
            return (
              <CourseCard
                key={e.enrollId}
                id={c.id}
                title={c.title}
                description={c.description}
                thumbnailUrl={c.thumbnailUrl}
                totalLessons={total}
                completedLessons={done}
                timeSpentMin={Math.round(timeSec / 60)}
                scorePct={avgScore}
                accessClosed={e.accessClosed}
                index={idx}
                adminHref={isAdmin ? `/portal/admin/courses/${c.id}` : undefined}
                formatBadge={live ? 'Мероприятие' : null}
                hideLessonProgress={liveNoScorm}
                playHref={liveNoScorm ? detailHref : undefined}
                primaryCtaLabel={liveNoScorm ? 'Подробности' : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
