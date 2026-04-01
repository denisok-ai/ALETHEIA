/**
 * Student: course detail — cover, progress, launch button. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CourseCoverPlaceholder } from '@/components/portal/CourseCoverPlaceholder';
import { CourseVerificationBlock } from './CourseVerificationBlock';
import { CourseMediaBlock, type CourseMediaItem } from './CourseMediaBlock';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, ArrowLeft, Settings } from 'lucide-react';
import { parseVerificationLessons } from '@/lib/verification-lessons';

function totalLessons(manifest: string | null): number {
  if (!manifest) return 1;
  try {
    const p = JSON.parse(manifest) as { items?: unknown[] };
    return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
  } catch { return 1; }
}

function lessonOptionsFromManifest(manifest: string | null): { id: string; title?: string }[] {
  if (!manifest) return [];
  try {
    const p = JSON.parse(manifest) as { items?: { identifier?: string; title?: string }[] };
    const items = p?.items;
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((it) => ({
      id: typeof it.identifier === 'string' ? it.identifier : 'main',
      title: typeof it.title === 'string' ? it.title : undefined,
    }));
  } catch { return []; }
}

type Props = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  if (!course) return { title: 'Курс' };
  return { title: course.title.slice(0, 60) };
}

export default async function StudentCourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) notFound();

  const [enrollment, progressByLesson, completedByLesson, courseMedia] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
    prisma.scormProgress.findMany({
      where: { userId, courseId },
      select: { lessonId: true, timeSpent: true, score: true },
    }),
    prisma.scormProgress.findMany({
      where: { userId, courseId, completionStatus: { in: ['completed', 'passed'] } },
      select: { lessonId: true },
    }),
    prisma.media.findMany({
      where: { courseId },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        fileUrl: true,
        mimeType: true,
        category: true,
        description: true,
        thumbnailUrl: true,
        type: true,
        viewsCount: true,
        allowDownload: true,
        ratingSum: true,
        ratingCount: true,
      },
    }),
  ]);

  const canAccess = !!enrollment || role === 'admin';
  if (!canAccess) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          items={[
            { href: '/portal/student/dashboard', label: 'Дашборд' },
            { href: '/portal/student/courses', label: 'Мои курсы' },
            { label: 'Доступ закрыт' },
          ]}
          title="Нет доступа"
          description="У вас нет доступа к этому курсу. Запишитесь на курс или обратитесь к администратору."
        />
        <div className="portal-card p-6">
          <Link href="/portal/student/courses">
            <Button variant="secondary"><ArrowLeft className="h-4 w-4 mr-2" /> К моим курсам</Button>
          </Link>
        </div>
      </div>
    );
  }

  const total = totalLessons(course.scormManifest);
  const completed = completedByLesson.length;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const timeSpentSec = progressByLesson.reduce((s, p) => s + p.timeSpent, 0);
  const timeSpentMin = Math.round(timeSpentSec / 60);
  const scoresWithValue = progressByLesson.filter((p): p is typeof p & { score: number } => p.score != null);
  const avgScore = scoresWithValue.length > 0
    ? Math.round(scoresWithValue.reduce((s, p) => s + p.score, 0) / scoresWithValue.length)
    : null;

  const isCompleted = total > 0 && completed >= total;
  const hasProgress = completed > 0 || progressByLesson.length > 0;

  const verificationLessonOptions = lessonOptionsFromManifest(course.scormManifest);
  const verificationConfigs = parseVerificationLessons(
    (course as { verificationRequiredLessonIds?: string | null }).verificationRequiredLessonIds
  );
  const verificationRequiredIds = verificationConfigs.map((c) => c.lessonId);

  const mediaItems: CourseMediaItem[] = courseMedia.map((m) => ({
    id: m.id,
    title: m.title,
    fileUrl: m.fileUrl,
    mimeType: m.mimeType,
    category: m.category,
    description: m.description,
    thumbnailUrl: m.thumbnailUrl,
    type: m.type,
    viewsCount: m.viewsCount,
    allowDownload: m.allowDownload,
    ratingSum: m.ratingSum,
    ratingCount: m.ratingCount,
  }));

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { href: '/portal/student/courses', label: 'Мои курсы' },
          { label: course.title },
        ]}
        title={course.title}
        description={course.description ?? undefined}
        actions={
          <Link href="/portal/student/courses">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Назад</Button>
          </Link>
        }
      />

      {/* Обложка */}
      <div className="portal-card overflow-hidden p-0">
        <div className="relative aspect-[21/9] w-full min-h-[180px] bg-[var(--portal-accent-soft)]">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
            />
          ) : (
            <CourseCoverPlaceholder title={course.title} variant={0} className="absolute inset-0 w-full h-full" />
          )}
        </div>
      </div>

      {/* Прогресс и действия */}
      <div className="portal-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--portal-text-muted)] mb-1">Прогресс прохождения (SCORM)</p>
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
                <span className="text-xs text-[var(--portal-text-soft)]">
                  Балл: {avgScore}%
                </span>
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
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Курс завершён
                </Button>
              ) : hasProgress ? (
                <Button variant="primary" size="lg">
                  <Play className="h-4 w-4 mr-2" /> Продолжить
                </Button>
              ) : (
                <Button variant="primary" size="lg">
                  <Play className="h-4 w-4 mr-2" /> Начать курс
                </Button>
              )}
            </Link>
            {role === 'admin' && (
              <Link href={`/portal/admin/courses/${courseId}`}>
                <Button variant="ghost" size="lg">
                  <Settings className="h-4 w-4 mr-2" /> Управлять
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {course.description && (
        <div className="portal-card p-6">
          <h2 className="text-sm font-semibold text-[var(--portal-text)] mb-2">О курсе</h2>
          <p className="text-sm text-[var(--portal-text-muted)] whitespace-pre-wrap">{course.description}</p>
        </div>
      )}

      <CourseMediaBlock items={mediaItems} />

      <CourseVerificationBlock
        courseId={courseId}
        lessonOptions={verificationLessonOptions}
        requiredLessonIds={verificationRequiredIds}
        verificationConfigs={verificationConfigs}
      />
    </div>
  );
}
