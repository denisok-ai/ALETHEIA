/**
 * Admin: course catalog, create course, upload SCORM.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Курсы' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CoursesPageWithGroups } from './CoursesPageWithGroups';

export default async function AdminCoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Курсы' }]} title="Курсы" description="База данных недоступна." />
      </div>
    );
  }

  const courses = await prisma.course.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 1000,
  });

  const initialCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    starts_at: c.startsAt?.toISOString() ?? null,
    ends_at: c.endsAt?.toISOString() ?? null,
    scorm_path: c.scormPath,
    thumbnail_url: c.thumbnailUrl,
    status: c.status,
    price: c.price,
    sort_order: c.sortOrder,
    created_at: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Курсы' },
        ]}
        title="Курсы"
        description="Каталог мероприятий: создание, редактирование, загрузка SCORM"
      />
      <CoursesPageWithGroups initialCourses={initialCourses} />
    </div>
  );
}
