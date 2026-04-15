/**
 * Student: course detail — данные на сервере, разметка с lucide в StudentCourseDetailView.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseVerificationLessons } from '@/lib/verification-lessons';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { isLiveEventCourse } from '@/lib/course-format';
import { CourseMediaBlock, type CourseMediaItem } from './CourseMediaBlock';
import { StudentCourseAccessDenied } from './StudentCourseAccessDenied';
import { StudentCourseDetailView } from './StudentCourseDetailView';

function totalLessons(manifest: string | null): number {
  if (!manifest) return 1;
  try {
    const p = JSON.parse(manifest) as { items?: unknown[] };
    return Array.isArray(p?.items) && p.items.length > 0 ? p.items.length : 1;
  } catch {
    return 1;
  }
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
  } catch {
    return [];
  }
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

  const [enrollment, progressByLesson, completedByLesson, courseMedia, gamification] = await Promise.all([
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
    getGamificationNumbers(),
  ]);

  const canAccess = !!enrollment || role === 'admin';
  if (!canAccess) {
    return <StudentCourseAccessDenied />;
  }

  const total = totalLessons(course.scormManifest);
  const completed = completedByLesson.length;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const timeSpentSec = progressByLesson.reduce((s, p) => s + p.timeSpent, 0);
  const timeSpentMin = Math.round(timeSpentSec / 60);
  const scoresWithValue = progressByLesson.filter((p): p is typeof p & { score: number } => p.score != null);
  const avgScore =
    scoresWithValue.length > 0
      ? Math.round(scoresWithValue.reduce((s, p) => s + p.score, 0) / scoresWithValue.length)
      : null;

  const isCompleted = total > 0 && completed >= total;
  const hasProgress = completed > 0 || progressByLesson.length > 0;

  const verificationLessonOptions = lessonOptionsFromManifest(course.scormManifest);
  const verificationConfigs = parseVerificationLessons(
    (course as { verificationRequiredLessonIds?: string | null }).verificationRequiredLessonIds
  );
  const verificationRequiredIds = verificationConfigs.map((c) => c.lessonId);

  const isLive = isLiveEventCourse(course.courseFormat);
  const hasScorm = !!(course.scormPath?.trim() || course.scormManifest?.trim());

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
    <StudentCourseDetailView
      courseId={courseId}
      title={course.title}
      description={course.description}
      thumbnailUrl={course.thumbnailUrl}
      isLive={isLive}
      hasScorm={hasScorm}
      startsAt={course.startsAt?.toISOString() ?? null}
      endsAt={course.endsAt?.toISOString() ?? null}
      eventVenue={course.eventVenue}
      eventUrl={course.eventUrl}
      pct={pct}
      completed={completed}
      total={total}
      timeSpentMin={timeSpentMin}
      avgScore={avgScore}
      isCompleted={isCompleted}
      hasProgress={hasProgress}
      mediaItems={mediaItems}
      verificationLessonOptions={verificationLessonOptions}
      verificationRequiredIds={verificationRequiredIds}
      verificationConfigs={verificationConfigs}
      xpVerificationApproved={gamification.xpVerificationApproved}
      aiTutorEnabled={course.aiTutorEnabled !== false}
    />
  );
}
