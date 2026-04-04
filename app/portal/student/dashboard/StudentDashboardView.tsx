'use client';

/**
 * Клиентская разметка дашборда: lucide + CourseCard (хуки/RSC с Turbopack дают TypeError useContext на сервере).
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, Award, Clock, Zap, ChevronRight, Bell } from 'lucide-react';
import { CourseCard } from '@/components/portal/CourseCard';
import { ChargeBatteryGauge } from '@/components/portal/ChargeBatteryGauge';
import { StudentOnboardingHint } from '@/components/portal/StudentOnboardingHint';
import { formatNotificationContent, formatNotificationType } from '@/lib/notification-content';
import { pluralize } from '@/lib/pluralize';

export type EarnedBadgeItem = { minXp: number; emoji: string; label: string };

export type DashboardCourseItem = {
  enrollmentId: string;
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  timeSpentMin: number;
  index: number;
  formatBadge: string | null;
  hideLessonProgress: boolean;
  playHref: string | undefined;
  primaryCtaLabel: string | undefined;
};

export type DashboardNotificationItem = {
  id: string;
  content: string | null;
  type: string | null;
  createdAt: string;
};

function StatCard({
  icon,
  label,
  value,
  sub,
  color = 'primary',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'primary' | 'gold' | 'green' | 'blue';
}) {
  const colorMap = {
    primary: { bg: 'bg-[var(--portal-accent-soft)]', text: 'text-[var(--portal-accent-dark)]' },
    gold: { bg: 'bg-[#FEF9C3]', text: 'text-[#A16207]' },
    green: { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]' },
    blue: { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]' },
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

export interface StudentDashboardViewProps {
  displayName: string;
  xpLessonComplete: number;
  xpPerLevel: number;
  level: number;
  chargePercent: number;
  pointsToNextBadge: number;
  xpProgress: number;
  earnedBadges: EarnedBadgeItem[];
  enrollmentsCount: number;
  completedCourses: number;
  certCount: number;
  totalTimeMin: number;
  courses: DashboardCourseItem[];
  notifications: DashboardNotificationItem[];
  /** Менеджер/админ открыл ЛК студента — показываем пояснение. */
  staffStudentPreview?: boolean;
}

export function StudentDashboardView({
  displayName,
  xpLessonComplete,
  xpPerLevel,
  level,
  chargePercent,
  pointsToNextBadge,
  xpProgress,
  earnedBadges,
  enrollmentsCount,
  completedCourses,
  certCount,
  totalTimeMin,
  courses,
  notifications,
  staffStudentPreview = false,
}: StudentDashboardViewProps) {
  const certSub =
    certCount > 0 ? `${certCount} ${pluralize(certCount, 'сертификат', 'сертификата', 'сертификатов')}` : undefined;
  const totalTimeDisplay =
    totalTimeMin < 60 ? `${totalTimeMin} мин` : `${Math.floor(totalTimeMin / 60)} ч`;

  return (
    <div className="space-y-6 max-w-6xl">
      {staffStudentPreview && (
        <div
          role="status"
          aria-label="Режим просмотра как слушатель"
          className="portal-card border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-[var(--portal-text)]"
        >
          <p className="font-medium text-amber-900">Режим просмотра как слушатель</p>
          <p className="mt-1 text-amber-900/90 text-xs leading-snug">
            Вы вошли под ролью менеджера или администратора. Здесь показан интерфейс студента (курсы и заряд — по
            вашей учётной записи, без записей слушателей). Вернитесь в свой кабинет через пункт меню слева.
          </p>
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-[var(--portal-radius-xl)] p-6 md:p-8"
        style={{
          background: 'linear-gradient(135deg, var(--portal-accent-soft) 0%, var(--portal-accent-muted) 50%, #F3E8FF 100%)',
          border: '1px solid var(--portal-accent-muted)',
        }}
      >
        <span className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-[var(--portal-accent)]/10 blur-3xl" aria-hidden />
        <span className="absolute bottom-0 left-16 h-32 w-32 rounded-full bg-[#9333EA]/08 blur-2xl" aria-hidden />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-[var(--portal-accent)] text-xs font-semibold uppercase tracking-widest mb-2">
              Добро пожаловать
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--portal-text)] leading-tight">
              {displayName}
              <span aria-hidden> 👋</span>
            </h1>
            <p className="mt-2 text-[var(--portal-text-muted)] text-sm max-w-md">
              Продолжайте обучение — каждый день делает вас сильнее. За первое завершение урока: +{xpLessonComplete} к уровню
              заряда · шкала пополняется каждые {xpPerLevel} единиц (
              <Link href="/portal/student/help#gamification" className="text-[var(--portal-accent)] hover:underline">
                как это работает
              </Link>
              ) ·{' '}
              <Link href="/portal/student/gamification" className="text-[var(--portal-accent)] hover:underline">
                история начислений
              </Link>
            </p>
          </div>

          <div
            className="flex items-center gap-4 bg-white/70 backdrop-blur-sm
            rounded-2xl px-5 py-4 min-w-[220px] max-w-[min(100%,20rem)] border border-white/80 shadow-sm"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full
              bg-[var(--portal-accent)] text-white font-bold text-lg shadow-sm"
              title={`Уровень заряда ${level}`}
            >
              {level}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-snug text-[var(--portal-text)]">
                Заряд: {chargePercent}%
                {pointsToNextBadge > 0 ? (
                  <span className="font-medium text-[var(--portal-text-muted)]">
                    , +{pointsToNextBadge} к уровню заряда
                  </span>
                ) : null}
              </p>
              <p className="text-[0.65rem] text-[var(--portal-text-soft)] mt-0.5 mb-2">Уровень заряда {level}</p>
              <ChargeBatteryGauge percent={xpProgress} className="mt-0.5" />
            </div>
          </div>
        </div>

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Всего курсов"
          value={enrollmentsCount}
          color="primary"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Завершено"
          value={completedCourses}
          sub={certSub}
          color="green"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Время обучения"
          value={totalTimeDisplay}
          color="blue"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Уровни заряда"
          value={`Заряд: ${chargePercent}%`}
          sub={`Уровень заряда ${level}`}
          color="gold"
        />
      </div>

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

        {courses.length === 0 ? (
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
            {courses.map((row) => (
              <CourseCard
                key={row.enrollmentId}
                id={row.id}
                title={row.title}
                description={row.description}
                thumbnailUrl={row.thumbnailUrl}
                totalLessons={row.totalLessons}
                completedLessons={row.completedLessons}
                timeSpentMin={row.timeSpentMin}
                index={row.index}
                formatBadge={row.formatBadge}
                hideLessonProgress={row.hideLessonProgress}
                playHref={row.playHref}
                primaryCtaLabel={row.primaryCtaLabel}
              />
            ))}
          </div>
        )}
      </div>

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
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)]"
                >
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--portal-text)] truncate">
                    {formatNotificationContent(n.content, n.type) || formatNotificationType(n.type)}
                  </p>
                  {formatNotificationContent(n.content, n.type) && (
                    <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">{formatNotificationType(n.type)}</p>
                  )}
                  <time className="text-[0.7rem] text-[var(--portal-text-soft)] mt-1 block">
                    {new Date(n.createdAt).toLocaleDateString('ru', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
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
