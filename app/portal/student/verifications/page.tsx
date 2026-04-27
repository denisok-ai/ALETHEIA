/**
 * Student: verification submissions — list, add form, edit pending.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Задания на проверку' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { PageHeader } from '@/components/portal/PageHeader';
import { VerificationsPageClient } from './VerificationsPageClient';
import { serializeThreadComment } from '@/lib/verification-thread-comments';

export default async function StudentVerificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="w-full">
        <PageHeader
          items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Задания на проверку' }]}
          title="Задания на проверку"
          description="Загрузка…"
        />
      </div>
    );
  }

  const [list, enrollments, gamification] = await Promise.all([
    prisma.phygitalVerification.findMany({
      where: { userId },
      include: {
        course: { select: { id: true, title: true } },
        threadComments: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, scormManifest: true } } },
    }),
    getGamificationNumbers(),
  ]);

  const initialList = list.map((v) => ({
    id: v.id,
    courseId: v.courseId,
    courseTitle: v.course?.title ?? 'Курс',
    lessonId: v.lessonId,
    assignmentType: v.assignmentType ?? 'video',
    videoUrl: v.videoUrl,
    status: v.status,
    comment: v.comment,
    createdAt: v.createdAt.toISOString(),
    threadComments: v.threadComments.map((c) => serializeThreadComment(c, v.userId)),
  }));

  const enrolledCourses = enrollments.map((e) => ({
    id: e.course.id,
    title: e.course.title,
    scormManifest: e.course.scormManifest,
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { label: 'Задания на проверку' },
        ]}
        title="Задания на проверку"
        description="Видео и текстовые ответы, отправленные на проверку менеджеру. После одобрения начисляется заряд — см. подсказку ниже."
      />
      <VerificationsPageClient
        viewerUserId={userId}
        initialList={initialList}
        enrolledCourses={enrolledCourses}
        xpVerificationApproved={gamification.xpVerificationApproved}
      />
    </div>
  );
}
