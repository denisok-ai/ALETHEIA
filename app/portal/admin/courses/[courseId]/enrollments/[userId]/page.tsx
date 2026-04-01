/**
 * Admin: detailed progress of one user in one course (per-lesson).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { ArrowLeft } from 'lucide-react';

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (seconds >= 60) return `${Math.floor(seconds / 60)} мин`;
  return `${seconds} сек`;
}

type Props = { params: Promise<{ courseId: string; userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId, userId } = await params;
  const [course, user] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { displayName: true } } },
    }),
  ]);
  const courseTitle = course?.title ?? 'Курс';
  const userName = user?.profile?.displayName ?? user?.email ?? 'Участник';
  return { title: `Прогресс: ${courseTitle} — ${userName}`.slice(0, 60) };
}

export default async function AdminCourseEnrollmentProgressPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const { courseId, userId } = await params;

  const [enrollment, course, user, progressList, certificate] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, scormManifest: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    }),
    prisma.scormProgress.findMany({
      where: { userId, courseId },
      orderBy: { lessonId: 'asc' },
    }),
    prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { certNumber: true, issuedAt: true },
    }),
  ]);

  if (!enrollment || !course || !user) notFound();

  let requiredLessonIds: { identifier: string; title?: string }[] = [{ identifier: 'main' }];
  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as {
        items?: { identifier: string; title?: string }[];
      };
      const items = manifest.items ?? [];
      if (items.length > 0)
        requiredLessonIds = items.map((i) => ({ identifier: i.identifier, title: i.title }));
    } catch {
      // keep main
    }
  }

  const progressByLesson: Record<
    string,
    { completionStatus: string | null; score: number | null; timeSpent: number }
  > = {};
  for (const p of progressList) {
    progressByLesson[p.lessonId] = {
      completionStatus: p.completionStatus,
      score: p.score,
      timeSpent: p.timeSpent,
    };
  }

  const lessons = requiredLessonIds.map((lesson) => {
    const prog = progressByLesson[lesson.identifier];
    return {
      lessonId: lesson.identifier,
      title: lesson.title ?? lesson.identifier,
      completionStatus: prog?.completionStatus ?? null,
      score: prog?.score ?? null,
      timeSpent: prog?.timeSpent ?? 0,
    };
  });

  const completedCount = lessons.filter(
  (l) => l.completionStatus === 'completed' || l.completionStatus === 'passed'
).length;
  const totalLessons = lessons.length;
  const avgScore =
    lessons.filter((l) => l.score != null).length > 0
      ? lessons.reduce((acc, l) => acc + (l.score ?? 0), 0) /
        lessons.filter((l) => l.score != null).length
      : null;
  const totalTimeSeconds = lessons.reduce((acc, l) => acc + l.timeSpent, 0);
  const displayName = user.profile?.displayName ?? user.email;

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/courses', label: 'Курсы' },
          { href: `/portal/admin/courses/${courseId}`, label: course.title },
          { label: `Результаты: ${displayName}` },
        ]}
        title="Результаты прохождения"
        description={`${course.title} — ${displayName}`}
        actions={
          <Link
            href={`/portal/admin/courses/${courseId}`}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:text-[var(--portal-accent)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К курсу
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="portal-card p-4">
          <p className="text-sm text-[var(--portal-text-muted)]">Записан</p>
          <p className="text-lg font-semibold text-[var(--portal-text)]">
            {new Date(enrollment.enrolledAt).toLocaleDateString('ru')}
          </p>
        </div>
        <div className="portal-card p-4">
          <p className="text-sm text-[var(--portal-text-muted)]">Прогресс</p>
          <p className="text-lg font-semibold text-[var(--portal-text)]">
            {completedCount}/{totalLessons} ({totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0}%)
          </p>
        </div>
        <div className="portal-card p-4">
          <p className="text-sm text-[var(--portal-text-muted)]">Средний балл</p>
          <p className="text-lg font-semibold text-[var(--portal-text)]">
            {avgScore != null ? `${Math.round(avgScore)}%` : '—'}
          </p>
        </div>
        <div className="portal-card p-4">
          <p className="text-sm text-[var(--portal-text-muted)]">Время в курсе</p>
          <p className="text-lg font-semibold text-[var(--portal-text)]">
            {totalTimeSeconds > 0 ? formatTime(totalTimeSeconds) : '—'}
          </p>
        </div>
      </div>

      {certificate && (
        <div className="portal-card p-4">
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Сертификат</h2>
          <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
            {certificate.certNumber} — выдан {new Date(certificate.issuedAt).toLocaleDateString('ru')}
          </p>
        </div>
      )}

      <div className="portal-card p-4">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">По урокам</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Урок</th>
                <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Статус</th>
                <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Балл</th>
                <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Время</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.lessonId} className="border-b border-[#E2E8F0]">
                  <td className="px-4 py-2 font-medium text-[var(--portal-text)]">{l.title}</td>
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">
                    {l.completionStatus === 'completed' || l.completionStatus === 'passed' ? (
                      <span className="text-green-600">Завершён</span>
                    ) : l.completionStatus ? (
                      l.completionStatus
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">
                    {l.score != null ? `${Math.round(l.score)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">
                    {l.timeSpent > 0 ? formatTime(l.timeSpent) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
