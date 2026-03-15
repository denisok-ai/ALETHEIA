/**
 * Admin: course detail — tabs: Overview, Enrolled, Learning results, Certificates, Notifications.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { ScormManifestViewer } from '@/components/admin/ScormManifestViewer';
import { CourseAdminClient } from './CourseAdminClient';
import { CourseAiTutorToggle } from './CourseAiTutorToggle';
import { CourseCoverBlock } from './CourseCoverBlock';
import { CourseMediaBlock } from './CourseMediaBlock';
import { CourseVerificationLessonsBlock } from './CourseVerificationLessonsBlock';
import { CourseDetailTabs } from './CourseDetailTabs';
import { CourseCardActions } from './CourseCardActions';
import { getCourseStatusLabel } from '@/lib/course-status';

type PageProps = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  if (!course) return { title: 'Курс' };
  return { title: course.title.slice(0, 60) };
}

export default async function AdminCourseDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });
  if (!course) notFound();

  const [enrollmentCount, startedCount, certificateCount, progressByLesson, courseMedia, allMedia] = await Promise.all([
    prisma.enrollment.count({ where: { courseId } }),
    prisma.scormProgress.groupBy({
      by: ['userId'],
      where: { courseId },
    }).then((r) => r.length),
    prisma.certificate.count({ where: { courseId } }),
    prisma.scormProgress.groupBy({
      by: ['lessonId'],
      where: { courseId },
      _count: { userId: true },
      _avg: { score: true },
    }),
    prisma.media.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, fileUrl: true },
    }),
    prisma.media.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, fileUrl: true, courseId: true },
    }),
  ]);

  const courseMediaItems = courseMedia.map((m) => ({ id: m.id, title: m.title, file_url: m.fileUrl }));
  const availableMediaItems = allMedia
    .filter((m) => m.courseId !== courseId)
    .map((m) => ({ id: m.id, title: m.title, file_url: m.fileUrl }));

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/courses', label: 'Курсы' },
          { label: course.title },
        ]}
        title={course.title}
        description={course.description ?? undefined}
        actions={
          <CourseCardActions
            courseId={courseId}
            courseTitle={course.title}
            courseDescription={course.description}
            courseStartsAt={course.startsAt?.toISOString() ?? null}
            courseEndsAt={course.endsAt?.toISOString() ?? null}
            coursePrice={course.price}
          />
        }
      />

      <div className="portal-card p-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="inline font-medium text-[var(--portal-text-muted)]">Статус:</dt>
            <dd className="inline ml-1 text-[var(--portal-text)]">{getCourseStatusLabel(course.status)}</dd>
          </div>
          {course.startsAt && (
            <div>
              <dt className="inline font-medium text-[var(--portal-text-muted)]">Начало:</dt>
              <dd className="inline ml-1 text-[var(--portal-text)]">{course.startsAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
          )}
          {course.endsAt && (
            <div>
              <dt className="inline font-medium text-[var(--portal-text-muted)]">Окончание:</dt>
              <dd className="inline ml-1 text-[var(--portal-text)]">{course.endsAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
          )}
        </dl>
      </div>

      <CourseDetailTabs courseId={courseId} courseTitle={course.title}>
        {/* Tab: Обзор */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="portal-card p-4">
              <h2 className="text-base font-semibold text-[var(--portal-text)]">Статистика SCORM</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--portal-text-muted)]">Записано</dt>
                  <dd className="font-medium text-[var(--portal-text)]">{enrollmentCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--portal-text-muted)]">Начали прохождение</dt>
                  <dd className="font-medium text-[var(--portal-text)]">{startedCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--portal-text-muted)]">Получили сертификат</dt>
                  <dd className="font-medium text-[var(--portal-text)]">{certificateCount}</dd>
                </div>
              </dl>
              {progressByLesson.length > 0 && (
                <div className="mt-4 border-t border-[#E2E8F0] pt-3">
                  <p className="text-xs font-medium text-[var(--portal-text-muted)]">По урокам</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {progressByLesson.map((p) => (
                      <li key={p.lessonId} className="flex justify-between">
                        <span className="truncate text-[var(--portal-text-muted)]">{p.lessonId}</span>
                        <span className="text-[var(--portal-text)]">
                          {p._count.userId} чел.
                          {p._avg.score != null && ` · ср. ${Math.round(p._avg.score)}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <CourseAiTutorToggle courseId={courseId} initialEnabled={course.aiTutorEnabled ?? true} />

            <CourseVerificationLessonsBlock
              courseId={courseId}
              scormManifest={course.scormManifest}
              verificationRequiredLessonIdsJson={course.verificationRequiredLessonIds}
            />

            <CourseCoverBlock
              courseId={courseId}
              initialThumbnailUrl={course.thumbnailUrl}
            />

            <div>
              <ScormManifestViewer
                scormManifest={course.scormManifest}
                scormVersion={course.scormVersion}
              />
            </div>
          </div>

          {course.scormPath && (
            <div className="portal-card p-4">
              <h2 className="text-base font-semibold text-[var(--portal-text)]">Просмотр SCORM-курса</h2>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                Откройте курс в плеере для проверки после импорта. Прогресс при просмотре не сохраняется.
              </p>
              <Link
                href={`/portal/student/courses/${courseId}/play`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-[#6366F1] px-6 font-semibold text-white transition-all hover:bg-[#4F46E5] shadow-sm hover:shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Открыть просмотр
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <CourseAdminClient
              courseId={courseId}
              courseTitle={course.title}
              hasScorm={!!course.scormPath}
            />
          </div>

          <CourseMediaBlock
            courseId={courseId}
            initialAttached={courseMediaItems}
            availableMedia={availableMediaItems}
          />
        </div>
      </CourseDetailTabs>
    </div>
  );
}
