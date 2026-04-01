/**
 * Student dashboard — redesigned: welcome banner, progress stats, course cards, notifications.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Дашборд' };

import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatNotificationContent, formatNotificationType } from '@/lib/notification-content';
import { pluralize } from '@/lib/pluralize';
import { CourseCard } from '@/components/portal/CourseCard';
import { StudentOnboardingHint } from '@/components/portal/StudentOnboardingHint';
import { BookOpen, Award, Clock, Zap, ChevronRight, Bell } from 'lucide-react';

function StatCard({
  icon,
  label,
  value,
  sub,
  color = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'primary' | 'gold' | 'green' | 'blue';
}) {
  const colorMap = {
    primary: { bg: 'bg-[var(--portal-accent-soft)]', text: 'text-[var(--portal-accent-dark)]' },
    gold:    { bg: 'bg-[#FEF9C3]', text: 'text-[#A16207]' },
    green:   { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]' },
    blue:    { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]' },
  };
  const c = colorMap[color];

  return (
    <div className="portal-card flex items-center gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--portal-text)] leading-tight">{value}</p>
        <p className="text-sm text-[var(--portal-text-muted)] mt-0.5">{label}</p>
        {sub && <p className="text-xs text-[var(--portal-text-soft)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const [enrollments, notifications, energy, progressByCourse, completedByCourse, certCount] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, course: { status: 'published' } },
      include: {
        course: {
          select: { id: true, title: true, description: true, thumbnailUrl: true, scormManifest: true },
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
  ]);

  function totalLessons(manifest: string | null): number {
    if (!manifest) return 1;
    try {
      const p = JSON.parse(manifest) as { items?: unknown[] };
      return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
    } catch { return 1; }
  }

  const displayName = (session?.user as { name?: string })?.name
    || (session?.user as { email?: string })?.email?.split('@')[0]
    || 'Слушатель';

  const xp          = energy?.xp ?? 0;
  const level       = energy?.level ?? 1;
  const xpToNext    = 100;
  const xpProgress  = ((xp % xpToNext) / xpToNext) * 100;
  const totalTimeMin = Math.round(
    progressByCourse.reduce((acc, p) => acc + (p._sum.timeSpent ?? 0), 0) / 60
  );
  const completedCourses = enrollments.filter((e) => {
    if (!e.course) return false;
    const total    = totalLessons(e.course.scormManifest);
    const done     = completedByCourse.find((x) => x.courseId === e.course!.id)?._count.lessonId ?? 0;
    return done >= total && total > 0;
  }).length;

  const BADGES = [
    { minXp: 0,   label: 'Новичок',   emoji: '🌱' },
    { minXp: 50,  label: 'Практик',   emoji: '💪' },
    { minXp: 100, label: 'Уверенный', emoji: '⭐' },
    { minXp: 200, label: 'Мастер',    emoji: '🏆' },
    { minXp: 500, label: 'Эксперт',   emoji: '👑' },
  ];
  const earnedBadges = BADGES.filter((b) => xp >= b.minXp);
  const nextBadge    = BADGES.find((b) => xp < b.minXp);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Welcome banner ── */}
      <div
        className="relative overflow-hidden rounded-[var(--portal-radius-xl)] p-6 md:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 50%, #F3E8FF 100%)',
          border: '1px solid var(--portal-accent-muted)',
        }}
      >
        {/* Декор-круги */}
        <span className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-[var(--portal-accent)]/10 blur-3xl" aria-hidden />
        <span className="absolute bottom-0 left-16 h-32 w-32 rounded-full bg-[#9333EA]/08 blur-2xl" aria-hidden />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-[var(--portal-accent)] text-xs font-semibold uppercase tracking-widest mb-2">
              Добро пожаловать
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--portal-text)] leading-tight">
              {displayName} 👋
            </h1>
            <p className="mt-2 text-[var(--portal-text-muted)] text-sm max-w-md">
              Продолжайте обучение — каждый день делает вас сильнее.
            </p>
          </div>

          {/* XP-блок */}
          <div className="flex items-center gap-4 bg-white/70 backdrop-blur-sm
            rounded-2xl px-5 py-4 min-w-[210px] border border-white/80 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full
              bg-[var(--portal-accent)] text-white font-bold text-lg shadow-sm">
              {level}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs text-[var(--portal-text-muted)] mb-1.5">
                <span className="font-semibold text-[var(--portal-text)]">{xp} XP</span>
                <span>ур. {level}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--portal-accent-muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--portal-accent)] transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              {nextBadge && (
                <p className="text-[0.68rem] text-[var(--portal-text-soft)] mt-1">
                  до «{nextBadge.label}» ещё {nextBadge.minXp - xp} XP
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Бейджи */}
        {earnedBadges.length > 0 && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            {earnedBadges.map((b) => (
              <span
                key={b.minXp}
                className="inline-flex items-center gap-1.5 rounded-full
                  bg-white/80 border border-[var(--portal-accent-muted)]
                  px-3 py-1 text-xs font-medium text-[var(--portal-accent-dark)]"
              >
                {b.emoji} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <StudentOnboardingHint />

      {/* ── Статистика ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Всего курсов"
          value={enrollments.length}
          color="primary"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Завершено"
          value={completedCourses}
          sub={certCount > 0 ? `${certCount} ${pluralize(certCount, 'сертификат', 'сертификата', 'сертификатов')}` : undefined}
          color="green"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Время обучения"
          value={totalTimeMin < 60 ? `${totalTimeMin} мин` : `${Math.floor(totalTimeMin / 60)} ч`}
          color="blue"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Очки энергии"
          value={`${xp} XP`}
          sub={`Уровень ${level}`}
          color="gold"
        />
      </div>

      {/* ── Мои курсы ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Мои курсы</h2>
          <Link
            href="/portal/student/courses"
            className="flex items-center gap-1 text-sm text-[var(--portal-primary)]
              hover:text-[var(--portal-primary-light)] font-medium transition"
          >
            Все курсы <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {enrollments.length === 0 ? (
          <div className="portal-card p-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-[var(--portal-text-soft)] mb-3" />
            <p className="text-[var(--portal-text-muted)]">
              Пока нет курсов.{' '}
              <Link href="/#pricing" className="text-[var(--portal-primary)] hover:underline">
                Выбрать курс
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((e, idx) => {
              const c = e.course;
              if (!c) return null;
              const total     = totalLessons(c.scormManifest);
              const completed = completedByCourse.find((x) => x.courseId === c.id)?._count.lessonId ?? 0;
              const timeSec   = progressByCourse.find((x) => x.courseId === c.id)?._sum.timeSpent ?? 0;
              return (
                <CourseCard
                  key={e.id}
                  id={c.id}
                  title={c.title}
                  description={c.description}
                  thumbnailUrl={c.thumbnailUrl}
                  totalLessons={total}
                  completedLessons={completed}
                  timeSpentMin={Math.round(timeSec / 60)}
                  index={idx}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Уведомления ── */}
      {notifications.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--portal-text)]">Уведомления</h2>
            <Link
              href="/portal/student/notifications"
              className="flex items-center gap-1 text-sm text-[var(--portal-primary)] hover:underline font-medium"
            >
              Все <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {notifications.map((n) => (
              <div key={n.id} className="portal-card flex items-start gap-3 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--portal-text)] truncate">
                    {formatNotificationContent(n.content, n.type) || formatNotificationType(n.type)}
                  </p>
                  {formatNotificationContent(n.content, n.type) && (
                    <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
                      {formatNotificationType(n.type)}
                    </p>
                  )}
                  <time className="text-[0.7rem] text-[var(--portal-text-soft)] mt-1 block">
                    {new Date(n.createdAt).toLocaleDateString('ru', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
