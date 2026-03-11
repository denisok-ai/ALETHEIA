/**
 * Admin: course detail — tabs: Overview, Enrolled, Learning results, Certificates, Notifications.
 */
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
import { CourseMediaBlock } from './CourseMediaBlock';
import { CourseDetailTabs } from './CourseDetailTabs';
import { CourseCardActions } from './CourseCardActions';
import { getCourseStatusLabel } from '@/lib/course-status';

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
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
    <div className="space-y-6">
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

      <div className="rounded-xl border border-border bg-white p-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="inline font-medium text-text-muted">Статус:</dt>
            <dd className="inline ml-1">{getCourseStatusLabel(course.status)}</dd>
          </div>
          {course.startsAt && (
            <div>
              <dt className="inline font-medium text-text-muted">Начало:</dt>
              <dd className="inline ml-1">{course.startsAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
          )}
          {course.endsAt && (
            <div>
              <dt className="inline font-medium text-text-muted">Окончание:</dt>
              <dd className="inline ml-1">{course.endsAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
          )}
        </dl>
      </div>

      <CourseDetailTabs courseId={courseId} courseTitle={course.title}>
        {/* Tab: Обзор */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-4">
              <h2 className="text-lg font-semibold text-dark">Статистика SCORM</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Записано</dt>
                  <dd className="font-medium">{enrollmentCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Начали прохождение</dt>
                  <dd className="font-medium">{startedCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Получили сертификат</dt>
                  <dd className="font-medium">{certificateCount}</dd>
                </div>
              </dl>
              {progressByLesson.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-text-muted">По урокам</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {progressByLesson.map((p) => (
                      <li key={p.lessonId} className="flex justify-between">
                        <span className="truncate text-text-muted">{p.lessonId}</span>
                        <span>
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

            <div>
              <ScormManifestViewer
                scormManifest={course.scormManifest}
                scormVersion={course.scormVersion}
              />
            </div>
          </div>

          {course.scormPath && (
            <div className="rounded-xl border border-border bg-white p-4">
              <h2 className="text-lg font-semibold text-dark">Просмотр SCORM-курса</h2>
              <p className="mt-1 text-sm text-text-muted">
                Откройте курс в плеере для проверки после импорта. Прогресс при просмотре не сохраняется.
              </p>
              <Link
                href={`/portal/student/courses/${courseId}/play`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-11 items-center justify-center rounded-lg border-2 border-primary bg-primary px-6 font-semibold text-white transition-all hover:opacity-90"
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
