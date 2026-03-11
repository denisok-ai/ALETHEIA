/**
 * Admin: mediatheque — list and upload.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { MediaPageWithGroups } from './MediaPageWithGroups';

export default async function AdminMediaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Медиатека' }]} title="Медиатека" description="База данных недоступна." />
      </div>
    );
  }

  const items = await prisma.media.findMany({
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    include: { course: { select: { id: true, title: true } } },
  });

  const initialItems = items.map((m) => ({
    id: m.id,
    title: m.title,
    file_url: m.fileUrl,
    mime_type: m.mimeType,
    category: m.category,
    description: m.description,
    type: m.type,
    views_count: m.viewsCount,
    allow_download: m.allowDownload,
    rating_sum: m.ratingSum,
    rating_count: m.ratingCount,
    created_at: m.createdAt.toISOString(),
    course_id: m.courseId,
    course_title: m.course?.title ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Медиатека' },
        ]}
        title="Медиатека"
        description="Загрузка и управление медиафайлами"
      />
      <MediaPageWithGroups initialItems={initialItems} />
    </div>
  );
}
