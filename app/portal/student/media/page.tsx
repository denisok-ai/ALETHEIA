/**
 * Student: mediatheque — list with cards, view link, download (if allowed), rating.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Медиатека' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { PageHeader } from '@/components/portal/PageHeader';
import { MediaListClient } from './MediaListClient';
import type { MediaListItem } from './MediaListClient';

export default async function StudentMediaPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <PageHeader
          items={[
            { href: '/portal/student/dashboard', label: 'Дашборд' },
            { label: 'Медиатека' },
          ]}
          title="Медиатека"
          description="Войдите в аккаунт для доступа к материалам."
        />
      </div>
    );
  }

  const [enrollments, userGroups, allMedia] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, accessClosed: false },
      select: { courseId: true },
    }),
    prisma.userGroup.findMany({
      where: { userId },
      select: { groupId: true },
    }),
    prisma.media.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: { mediaGroups: { select: { groupId: true } } },
    }),
  ]);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const userGroupIds = new Set(userGroups.map((ug) => ug.groupId));

  const list = allMedia.filter((m) => {
    if (m.courseId && enrolledCourseIds.has(m.courseId)) return true;
    const mediaGroupIds = m.mediaGroups.map((mg) => mg.groupId);
    if (mediaGroupIds.length > 0) {
      return mediaGroupIds.some((gid) => userGroupIds.has(gid));
    }
    return true;
  });

  const items: MediaListItem[] = list.map((m) => ({
    id: m.id,
    title: m.title,
    fileUrl: m.fileUrl,
    mimeType: m.mimeType,
    category: m.category,
    description: m.description,
    type: m.type,
    viewsCount: m.viewsCount,
    allowDownload: m.allowDownload,
    ratingSum: m.ratingSum,
    ratingCount: m.ratingCount,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { label: 'Медиатека' },
        ]}
        title="Медиатека"
        description="Видео, материалы и аудио"
      />
      <MediaListClient items={items} />
    </div>
  );
}
