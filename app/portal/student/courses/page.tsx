/**
 * Student: list of enrolled courses with progress.
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import Image from 'next/image';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';

export default async function StudentCoursesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Мои курсы</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const isAdmin = role === 'admin';
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { status: 'published' } },
    include: {
      course: { select: { id: true, title: true, description: true, thumbnailUrl: true, scormManifest: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  let list: { id: string; course: { id: string; title: string; description: string | null; thumbnailUrl: string | null; scormManifest: string | null } }[];
  if (isAdmin) {
    const allCourses = await prisma.course.findMany({
      where: { status: 'published' },
      select: { id: true, title: true, description: true, thumbnailUrl: true, scormManifest: true },
      orderBy: { sortOrder: 'asc' },
    });
    list = allCourses.map((c) => ({ id: `admin-${c.id}`, course: c }));
  } else {
    list = enrollments.map((e) => ({ id: e.id, course: e.course! }));
  }

  const progressByCourse = await prisma.scormProgress.groupBy({
    by: ['courseId'],
    where: { userId },
    _count: { lessonId: true },
    _sum: { timeSpent: true },
  });
  const completedByCourse = await prisma.scormProgress.groupBy({
    by: ['courseId'],
    where: { userId, completionStatus: 'completed' },
    _count: { lessonId: true },
  });

  function totalLessons(manifest: string | null): number {
    if (!manifest) return 1;
    try {
      const p = JSON.parse(manifest) as { items?: unknown[] };
      return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
    } catch {
      return 1;
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Мои курсы' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Мои курсы</h1>
      <p className="mt-1 text-text-muted">
        {isAdmin ? 'Все курсы (доступ ко всем как администратор)' : 'Курсы, на которые вы записаны'}
      </p>

      {list.length === 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-text-muted">
            У вас пока нет записей на курсы. <Link href="/#pricing" className="text-primary hover:underline">Перейти к тарифам</Link>
          </p>
          {isAdmin && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Нет ни одного курса. Создайте курс в{' '}
              <Link href="/portal/admin/courses" className="font-medium text-primary underline hover:no-underline">Админка → Курсы</Link>.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => {
            const c = e.course;
            if (!c) return null;
            const total = totalLessons(c.scormManifest);
            const completed = completedByCourse.find((x) => x.courseId === c.id)?._count.lessonId ?? 0;
            const timeSpent = progressByCourse.find((x) => x.courseId === c.id)?._sum.timeSpent ?? 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <li key={e.id}>
                <div className="block rounded-xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md">
                  <Link href={`/portal/student/courses/${c.id}`} className="block">
                    {c.thumbnailUrl && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-bg-soft">
                        <Image
                          src={c.thumbnailUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <h2 className="mt-3 font-semibold text-dark">{c.title}</h2>
                    {c.description && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.description}</p>}
                    {total > 0 && !isAdmin && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>Прогресс</span>
                          <span>{completed}/{total} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {timeSpent > 0 && (
                          <p className="mt-1 text-xs text-text-muted">
                            Время: {Math.floor(timeSpent / 60)} мин
                          </p>
                        )}
                      </div>
                    )}
                    {total > 0 && isAdmin && (
                      <p className="mt-2 text-xs text-text-muted">Уроков: {total}</p>
                    )}
                    <span className="mt-2 inline-block text-sm text-primary">Открыть курс →</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href={`/portal/admin/courses/${c.id}`}
                      className="mt-2 inline-block text-xs text-amber-700 hover:underline"
                    >
                      Управлять в админке
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
