'use client';

/**
 * Разметка карточки курса студента: lucide + обложка (Next/Image) только на клиенте.
 */
import Image from 'next/image';
import Link from 'next/link';
import {
  Play,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  MapPin,
  ExternalLink,
  Users,
  MessageCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { CourseCoverPlaceholder } from '@/components/portal/CourseCoverPlaceholder';
import { CourseVerificationBlock } from './CourseVerificationBlock';
import { CourseMediaBlock, type CourseMediaItem } from './CourseMediaBlock';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PORTAL_PATH } from '@/lib/portal-paths';
import type { VerificationLessonConfig } from '@/lib/verification-lessons';

export interface StudentCourseDetailViewProps {
  courseId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  isLive: boolean;
  hasScorm: boolean;
  startsAt: string | null;
  endsAt: string | null;
  eventVenue: string | null;
  eventUrl: string | null;
  pct: number;
  completed: number;
  total: number;
  timeSpentMin: number;
  avgScore: number | null;
  isCompleted: boolean;
  hasProgress: boolean;
  mediaItems: CourseMediaItem[];
  verificationLessonOptions: { id: string; title?: string }[];
  verificationRequiredIds: string[];
  verificationConfigs: VerificationLessonConfig[];
  xpVerificationApproved: number;
  /** false = тьютор выключен для курса в админке */
  aiTutorEnabled?: boolean;
}

export function StudentCourseDetailView({
  courseId,
  title,
  description,
  thumbnailUrl,
  isLive,
  hasScorm,
  startsAt,
  endsAt,
  eventVenue,
  eventUrl,
  pct,
  completed,
  total,
  timeSpentMin,
  avgScore,
  isCompleted,
  hasProgress,
  mediaItems,
  verificationLessonOptions,
  verificationRequiredIds,
  verificationConfigs,
  xpVerificationApproved,
  aiTutorEnabled = true,
}: StudentCourseDetailViewProps) {
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <PageHeader
        items={[
          { href: PORTAL_PATH.studentDashboard, label: 'Дашборд' },
          { href: '/portal/student/courses', label: 'Мои курсы' },
          { label: title },
        ]}
        title={title}
        description={description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/portal/student/courses"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Link>
          </div>
        }
      />

      <div className="portal-card overflow-hidden p-0">
        <div className="relative aspect-[21/9] w-full min-h-[180px] bg-[var(--portal-accent-soft)]">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          ) : (
            <CourseCoverPlaceholder title={title} variant={0} className="absolute inset-0 w-full h-full" />
          )}
        </div>
      </div>

      {isLive && (
        <div className="portal-card p-6 space-y-4 border border-[var(--portal-accent-muted)]/40 bg-[var(--portal-accent-soft)]/30">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--portal-accent-dark)] shrink-0" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--portal-text)]">Очное мероприятие / вебинар</h2>
          </div>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Участие по расписанию. При необходимости ниже доступны дополнительные онлайн-материалы (SCORM) и задания на
            проверку.
          </p>
          {(startsAt || endsAt) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {startsAt && (
                <div className="flex items-start gap-2 min-w-0">
                  <Calendar className="h-4 w-4 text-[var(--portal-text-muted)] shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-xs text-[var(--portal-text-muted)]">Начало</p>
                    <p className="font-medium text-[var(--portal-text)]">
                      {new Date(startsAt).toLocaleString('ru-RU', dateOpts)}
                    </p>
                  </div>
                </div>
              )}
              {endsAt && (
                <div className="flex items-start gap-2 min-w-0">
                  <Calendar className="h-4 w-4 text-[var(--portal-text-muted)] shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-xs text-[var(--portal-text-muted)]">Окончание</p>
                    <p className="font-medium text-[var(--portal-text)]">
                      {new Date(endsAt).toLocaleString('ru-RU', dateOpts)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {eventVenue?.trim() && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-[var(--portal-text-muted)] shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-xs text-[var(--portal-text-muted)]">Площадка / формат</p>
                <p className="text-[var(--portal-text)] whitespace-pre-wrap">{eventVenue.trim()}</p>
              </div>
            </div>
          )}
          {eventUrl?.trim() && (
            <div>
              <a
                href={eventUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal-accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 transition-opacity"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                Перейти к вебинару (внешняя ссылка)
              </a>
            </div>
          )}
        </div>
      )}

      {(!isLive || hasScorm) && (
        <div className="portal-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--portal-text-muted)] mb-1">
                {isLive ? 'Дополнительные материалы (SCORM)' : 'Прогресс прохождения (SCORM)'}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-bold text-[var(--portal-text)]">{pct}%</span>
                <span className="text-sm text-[var(--portal-text-muted)]">
                  {completed} из {total} уроков
                </span>
                {timeSpentMin > 0 && (
                  <span className="text-xs text-[var(--portal-text-soft)]">
                    Время: {timeSpentMin < 60 ? `${timeSpentMin} мин` : `${Math.floor(timeSpentMin / 60)} ч`}
                  </span>
                )}
                {avgScore != null && (
                  <span className="text-xs text-[var(--portal-text-soft)]">Балл: {avgScore}%</span>
                )}
              </div>
              <div className="mt-2 progress-track max-w-md">
                <div
                  className={`progress-fill ${pct === 100 ? 'done' : pct >= 30 ? 'mid' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link href={`/portal/student/courses/${courseId}/play`}>
                {isCompleted ? (
                  <Button variant="secondary" size="lg">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Курс завершён
                  </Button>
                ) : hasProgress ? (
                  <Button variant="primary" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    Продолжить
                  </Button>
                ) : (
                  <Button variant="primary" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    {isLive ? 'Открыть материалы' : 'Начать курс'}
                  </Button>
                )}
              </Link>
            </div>
          </div>
          {hasScorm && aiTutorEnabled && (
            <p className="mt-4 flex gap-2 border-t border-[#E2E8F0] pt-4 text-xs text-[var(--portal-text-muted)]">
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[var(--portal-accent)] mt-0.5" aria-hidden />
              <span>
                В плеере урока в правом нижнем углу есть чат «AI-тьютор»: можно задать вопрос по материалам текущего урока.{' '}
                <Link href="/portal/student/help#ai-tutor" className="text-[var(--portal-accent)] font-medium hover:underline">
                  Подробнее в «Помощи»
                </Link>
                .
              </span>
            </p>
          )}
          {hasScorm && !aiTutorEnabled && (
            <p className="mt-4 flex gap-2 border-t border-[#E2E8F0] pt-4 text-xs text-[var(--portal-text-soft)]">
              <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-70 mt-0.5" aria-hidden />
              <span>
                Для этого курса чат AI-тьютора отключён. Вопросы по содержанию можно задать через{' '}
                <Link href="/portal/student/support" className="text-[var(--portal-accent)] font-medium hover:underline">
                  Поддержку
                </Link>
                .
              </span>
            </p>
          )}
        </div>
      )}

      {isLive && !hasScorm && (
        <div className="portal-card p-5 border border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
          <p className="text-sm text-[var(--portal-text-muted)]">
            Онлайн-уроки (SCORM) к этому мероприятию не подключены. Если организатор добавит материалы позже, здесь появится
            прогресс и кнопка запуска.
          </p>
        </div>
      )}

      {description && (
        <div className="portal-card p-6">
          <h2 className="text-sm font-semibold text-[var(--portal-text)] mb-2">О курсе</h2>
          <p className="text-sm text-[var(--portal-text-muted)] whitespace-pre-wrap">{description}</p>
        </div>
      )}

      <CourseMediaBlock items={mediaItems} />

      <CourseVerificationBlock
        courseId={courseId}
        lessonOptions={verificationLessonOptions}
        requiredLessonIds={verificationRequiredIds}
        verificationConfigs={verificationConfigs}
        xpVerificationApproved={xpVerificationApproved}
      />
    </div>
  );
}
