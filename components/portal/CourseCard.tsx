'use client';

/**
 * Карточка курса для студента — обложка, прогресс, статус, запуск в 1 клик.
 * Без вложенных <a> тегов (hydration-safe).
 */
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Play, CheckCircle2, Clock, BookOpen, RotateCcw, Settings } from 'lucide-react';
import { CourseCoverPlaceholder } from './CourseCoverPlaceholder';
import { cn } from '@/lib/utils';

export type CourseStatus = 'not_started' | 'in_progress' | 'completed' | 'locked';

interface CourseCardProps {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  totalLessons?: number;
  completedLessons?: number;
  timeSpentMin?: number;
  /** Средний балл SCORM по курсу, % (0–100). */
  scorePct?: number;
  status?: CourseStatus;
  accessClosed?: boolean;
  index?: number;
  detailHref?: string;
  playHref?: string;
  adminHref?: string;
}

const STATUS_CONFIG: Record<CourseStatus, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  not_started: { label: 'Не начат',    badgeClass: 'badge-neutral', icon: <BookOpen className="h-3 w-3" /> },
  in_progress: { label: 'В процессе', badgeClass: 'badge-info',    icon: <Clock className="h-3 w-3" /> },
  completed:   { label: 'Завершён',   badgeClass: 'badge-active',  icon: <CheckCircle2 className="h-3 w-3" /> },
  locked:      { label: 'Закрыт',     badgeClass: 'badge-neutral', icon: null },
};

export function CourseCard({
  id,
  title,
  description,
  thumbnailUrl,
  totalLessons = 1,
  completedLessons = 0,
  timeSpentMin = 0,
  scorePct,
  status,
  accessClosed = false,
  index = 0,
  detailHref,
  playHref,
  adminHref,
}: CourseCardProps) {
  const router = useRouter();

  const derivedStatus: CourseStatus =
    status ??
    (accessClosed
      ? 'locked'
      : completedLessons >= totalLessons && completedLessons > 0
      ? 'completed'
      : completedLessons > 0
      ? 'in_progress'
      : 'not_started');

  const pct  = totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
  const cfg  = STATUS_CONFIG[derivedStatus];
  const detail = detailHref ?? `/portal/student/courses/${id}`;
  const play   = playHref   ?? `/portal/student/courses/${id}/play`;

  function handleCoverClick() {
    if (!accessClosed) router.push(detail);
  }
  function handlePlayClick(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(play);
  }

  return (
    <article className={cn(
      'group flex flex-col overflow-hidden rounded-[var(--portal-radius-lg)]',
      'bg-[var(--portal-surface)] border border-[#E2E8F0]',
      'shadow-[var(--portal-shadow-sm)] hover:shadow-[var(--portal-shadow-md)]',
      'transition-all duration-200 hover:-translate-y-0.5',
      accessClosed && 'opacity-60'
    )}>

      {/* ── Обложка (div, не Link — чтобы не было вложенных <a>) ── */}
      <div
        onClick={handleCoverClick}
        className={cn(
          'relative aspect-[16/9] w-full overflow-hidden shrink-0',
          !accessClosed && 'cursor-pointer'
        )}
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <CourseCoverPlaceholder title={title} variant={index} className="absolute inset-0" />
        )}

        {/* Статус-бейдж */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none">
          <span className={cn('status-badge', cfg.badgeClass)}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>

        {/* Play-кнопка: overlay с pointer-events-none, кнопка — pointer-events-auto.
            Иначе overlay перехватывает клики по обложке и блокирует переход на страницу курса. */}
        {!accessClosed && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center pointer-events-none',
            'bg-black/0 group-hover:bg-[var(--portal-accent)]/20 transition-all duration-200'
          )}>
            <button
              type="button"
              onClick={handlePlayClick}
              aria-label={`Запустить курс "${title}"`}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full pointer-events-auto',
                'bg-white text-[var(--portal-accent-dark)] shadow-lg',
                'scale-0 group-hover:scale-100 transition-transform duration-200'
              )}
            >
              {derivedStatus === 'completed'
                ? <RotateCcw className="h-5 w-5" />
                : <Play className="h-5 w-5 ml-0.5" />}
            </button>
          </div>
        )}
      </div>

      {/* ── Контент ── */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          {accessClosed ? (
            <span className="block font-semibold text-[var(--portal-text)] line-clamp-2 leading-snug text-[0.9375rem]">
              {title}
            </span>
          ) : (
            <Link
              href={detail}
              className="block font-semibold text-[var(--portal-text)] hover:text-[var(--portal-accent)]
                line-clamp-2 leading-snug text-[0.9375rem] transition-colors"
            >
              {title}
            </Link>
          )}
          {description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--portal-text-muted)] leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Прогресс прохождения — всегда показываем */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--portal-text-muted)]">Прогресс: {completedLessons} из {totalLessons} уроков</span>
            <span className="font-semibold text-[var(--portal-text)]">{pct}%</span>
          </div>
          <div className="progress-track">
            <div
              className={cn('progress-fill', pct === 100 ? 'done' : pct >= 30 ? 'mid' : '')}
              style={{ width: `${Math.max(0, pct)}%` }}
            />
          </div>
          {(timeSpentMin > 0 || scorePct != null) && (
            <p className="mt-1.5 text-xs text-[var(--portal-text-soft)]">
              {timeSpentMin > 0 && (
                <>Время: {timeSpentMin < 60 ? `${timeSpentMin} мин` : `${Math.floor(timeSpentMin / 60)} ч ${timeSpentMin % 60} мин`}</>
              )}
              {timeSpentMin > 0 && scorePct != null && ' · '}
              {scorePct != null && <>Балл: {scorePct}%</>}
            </p>
          )}
        </div>

        {/* Кнопки: Завершён | Продолжить (если есть прогресс) | Начать курс */}
        <div className="mt-4 flex items-center gap-2">
          {accessClosed ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-amber-700">Доступ закрыт</span>
              <span className="text-xs text-[var(--portal-text-muted)]">
                Период обучения завершён.{' '}
                <Link href="/portal/student/support" className="text-[var(--portal-accent)] hover:underline">
                  Обратитесь в поддержку
                </Link>
                {' '}для продления.
              </span>
            </div>
          ) : derivedStatus === 'completed' ? (
            <Link href={play} className="course-launch-btn done flex-1 justify-center">
              <CheckCircle2 className="h-4 w-4" /> Завершён
            </Link>
          ) : derivedStatus === 'in_progress' ? (
            <Link href={play} className="course-launch-btn primary flex-1 justify-center">
              <Play className="h-3.5 w-3.5" /> Продолжить
            </Link>
          ) : (
            <Link href={play} className="course-launch-btn start flex-1 justify-center">
              <Play className="h-3.5 w-3.5" /> Начать курс
            </Link>
          )}

          {adminHref && (
            <Link
              href={adminHref}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                border border-[#E2E8F0] text-[var(--portal-text-muted)]
                hover:bg-[var(--portal-accent-soft)] hover:text-[var(--portal-accent)] hover:border-[var(--portal-accent-muted)]
                transition"
              title="Управлять в админке"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
