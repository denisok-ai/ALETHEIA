/**
 * Student: course detail and link to SCORM player.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return <p className="text-text-muted">Загрузка…</p>;
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });
  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  const canAccess = !!enrollment || role === 'admin';
  if (!canAccess) {
    return (
      <div>
        <p className="text-text-muted">У вас нет доступа к этому курсу.</p>
        <Link href="/portal/student/courses" className="mt-2 inline-block text-primary hover:underline">← К моим курсам</Link>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { href: '/portal/student/courses', label: 'Мои курсы' },
          { label: course.title },
        ]}
      />
      <Link href="/portal/student/courses" className="mt-2 inline-block text-sm text-primary hover:underline">← Мои курсы</Link>
      <h1 className="mt-4 font-heading text-2xl font-bold text-dark">{course.title}</h1>
      {course.description && <p className="mt-2 text-text-muted">{course.description}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/portal/student/courses/${courseId}/play`}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90"
        >
          Открыть курс (плеер)
        </Link>
        {role === 'admin' && (
          <Link
            href={`/portal/admin/courses/${courseId}`}
            className="inline-flex items-center rounded-lg border border-amber-600 bg-amber-50 px-4 py-2 font-medium text-amber-800 hover:bg-amber-100"
          >
            Управлять курсом в админке
          </Link>
        )}
      </div>
    </div>
  );
}
