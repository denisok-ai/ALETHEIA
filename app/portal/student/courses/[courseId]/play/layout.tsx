/**
 * Layout for SCORM play page — sets tab title, checks course access before loading player.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const metadata: Metadata = { title: 'Плеер' };

export default async function PlayLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  let role = (session?.user as { role?: string })?.role;

  if (!userId) {
    redirect(`/login?redirect=${encodeURIComponent(`/portal/student/courses/${courseId}/play`)}`);
  }

  if (!role) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { role: true },
    });
    role = profile?.role ?? 'user';
  }

  if (role !== 'admin' && role !== 'manager') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.accessClosed) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="max-w-md text-[var(--portal-text)]">
            {enrollment?.accessClosed
              ? 'Доступ к этому курсу закрыт. Обратитесь в поддержку школы.'
              : 'Плеер доступен только после записи на курс. Оформите доступ на странице курса или в каталоге.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/portal/student/courses/${courseId}`}
              className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4F46E5]"
            >
              Страница курса
            </Link>
            <Link
              href="/portal/student/courses"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
            >
              Все курсы
            </Link>
          </div>
        </div>
      );
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return notFound();

  return <>{children}</>;
}
