/**
 * Admin: course detail — tabs: Overview, Enrolled, Learning results, Certificates, Notifications.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ScormPackageCard } from './ScormPackageCard';
import { ScormVersionsBlock } from './ScormVersionsBlock';
import { CourseCertificateTemplateBlock } from './CourseCertificateTemplateBlock';
import { CourseAiTutorBlock } from './CourseAiTutorBlock';
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

  const [enrollmentCount, startedCount, certificateCount, courseMedia, allMedia, boundCertTemplate] = await Promise.all([
    prisma.enrollment.count({ where: { courseId } }),
    prisma.scormProgress.groupBy({
      by: ['userId'],
      where: { courseId },
    }).then((r) => r.length),
    prisma.certificate.count({ where: { courseId } }),
    prisma.media.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, fileUrl: true, mimeType: true, thumbnailUrl: true, sortOrder: true },
    }),
    prisma.media.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, fileUrl: true, mimeType: true, thumbnailUrl: true, courseId: true },
    }),
    prisma.certificateTemplate.findFirst({
      where: { courseId },
      select: { id: true },
    }),
  ]);

  const courseMediaItems = courseMedia.map((m) => ({
    id: m.id,
    title: m.title,
    file_url: m.fileUrl,
    mime_type: m.mimeType,
    thumbnail_url: m.thumbnailUrl,
    sort_order: m.sortOrder,
  }));
  const availableMediaItems = allMedia
    .filter((m) => m.courseId !== courseId)
    .map((m) => ({
      id: m.id,
      title: m.title,
      file_url: m.fileUrl,
      mime_type: m.mimeType,
      thumbnail_url: m.thumbnailUrl,
    }));

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
          <div>
            <dt className="inline font-medium text-[var(--portal-text-muted)]">Записано:</dt>
            <dd className="inline ml-1 text-[var(--portal-text)]">{enrollmentCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-[var(--portal-text-muted)]">Начали:</dt>
            <dd className="inline ml-1 text-[var(--portal-text)]">{startedCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-[var(--portal-text-muted)]">Сертификатов:</dt>
            <dd className="inline ml-1 text-[var(--portal-text)]">{certificateCount}</dd>
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
        {/* Tab: Обзор — сгруппировано по смыслу */}
        <div className="space-y-8">
          <section className="space-y-3" aria-labelledby="course-overview-learning">
            <h2
              id="course-overview-learning"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]"
            >
              Обучение и проверка
            </h2>
            <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
              <CourseAiTutorBlock courseId={courseId} initialEnabled={course.aiTutorEnabled ?? true} />
              <CourseVerificationLessonsBlock
                courseId={courseId}
                scormManifest={course.scormManifest}
                verificationRequiredLessonIdsJson={course.verificationRequiredLessonIds}
              />
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="course-overview-branding">
            <h2
              id="course-overview-branding"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]"
            >
              Оформление и выдача
            </h2>
            <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
              <CourseCoverBlock courseId={courseId} initialThumbnailUrl={course.thumbnailUrl} />
              <CourseCertificateTemplateBlock
                courseId={courseId}
                courseTitle={course.title}
                initialBoundTemplateId={boundCertTemplate?.id ?? null}
              />
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="course-overview-scorm">
            <h2
              id="course-overview-scorm"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]"
            >
              SCORM-пакет
            </h2>
            <div className="space-y-6">
              <ScormPackageCard
                courseId={courseId}
                scormManifest={course.scormManifest}
                scormVersion={course.scormVersion}
              />
              <ScormVersionsBlock courseId={courseId} />
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="course-overview-media">
            <h2
              id="course-overview-media"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]"
            >
              Медиатека курса
            </h2>
            <CourseMediaBlock
              courseId={courseId}
              initialAttached={courseMediaItems}
              availableMedia={availableMediaItems}
            />
          </section>
        </div>
      </CourseDetailTabs>
    </div>
  );
}
