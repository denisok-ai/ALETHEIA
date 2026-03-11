/**
 * Student dashboard: progress overview, recent activity, notifications preview.
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const [enrollments, notifications, energy, progressByCourse] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, course: { status: 'published' } },
      include: { course: { select: { id: true, title: true, thumbnailUrl: true, scormManifest: true } } },
      orderBy: { enrolledAt: 'desc' },
      take: 5,
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.userEnergy.findUnique({ where: { userId } }),
    prisma.scormProgress.groupBy({
      by: ['courseId'],
      where: { userId },
      _count: { lessonId: true },
      _sum: { timeSpent: true },
    }),
  ]);

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

  const xp = energy?.xp ?? 0;
  const level = energy?.level ?? 1;
  const xpForNextLevel = 100;
  const progressToNext = (xp % xpForNextLevel) / xpForNextLevel;

  const BADGES = [
    { minXp: 0, label: 'Новичок', emoji: '🌱' },
    { minXp: 50, label: 'Практик', emoji: '💪' },
    { minXp: 100, label: 'Уверенный', emoji: '⭐' },
    { minXp: 200, label: 'Мастер', emoji: '🏆' },
    { minXp: 500, label: 'Эксперт', emoji: '👑' },
  ];
  const earnedBadges = BADGES.filter((b) => xp >= b.minXp);
  const nextBadge = BADGES.find((b) => xp < b.minXp);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Дашборд' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Дашборд</h1>
      <p className="mt-1 text-text-muted">Обзор обучения и активность</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Шкала Энергии</h2>
        <p className="mt-1 text-sm text-text-muted">XP за практики мышечного тестирования</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 font-bold text-secondary">
            {level}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <span className="text-dark">{xp} XP</span>
              <span className="text-text-muted">Уровень {level}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-soft">
              <div
                className="h-full rounded-full bg-secondary transition-all"
                style={{ width: `${progressToNext * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-dark">Бейджи</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {earnedBadges.map((b) => (
              <span
                key={b.minXp}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-3 py-1 text-sm font-medium text-secondary"
                title={b.label}
              >
                <span>{b.emoji}</span>
                <span>{b.label}</span>
              </span>
            ))}
            {nextBadge && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-text-muted"
                title={`Ещё ${nextBadge.minXp - xp} XP до «${nextBadge.label}»`}
              >
                <span>{nextBadge.emoji}</span>
                <span>{nextBadge.label}</span>
                <span className="text-xs">({nextBadge.minXp - xp} XP)</span>
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Мои курсы</h2>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-text-muted">Пока нет записей на курсы. <Link href="/#pricing" className="text-primary hover:underline">Выбрать курс</Link></p>
        ) : (
          <ul className="mt-3 space-y-3">
            {enrollments.map((e) => {
              const c = e.course;
              const total = c ? totalLessons(c.scormManifest) : 1;
              const completed = c ? (completedByCourse.find((x) => x.courseId === c.id)?._count.lessonId ?? 0) : 0;
              const timeSpent = c ? (progressByCourse.find((x) => x.courseId === c.id)?._sum.timeSpent ?? 0) : 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <li key={e.id} className="rounded-lg border border-border bg-white p-3">
                  <Link href="/portal/student/courses" className="font-medium text-primary hover:underline">
                    {c?.title ?? 'Курс'}
                  </Link>
                  {total > 0 && (
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
                        <p className="mt-1 text-xs text-text-muted">Время: {Math.floor(timeSpent / 60)} мин</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Уведомления</h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-text-muted">Нет новых уведомлений</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-white p-3">
                <span className="text-sm font-medium text-dark">{n.type}</span>
                <p className="text-sm text-text-muted">{String(n.content ?? '')}</p>
                <time className="text-xs text-text-soft">{new Date(n.createdAt).toLocaleDateString('ru')}</time>
              </li>
            ))}
          </ul>
        )}
        <Link href="/portal/student/notifications" className="mt-2 inline-block text-sm text-primary hover:underline">Все уведомления →</Link>
      </section>
    </div>
  );
}
