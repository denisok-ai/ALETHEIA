/**
 * Admin: publications catalog.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Публикации' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { PublicationsAdminClient } from './PublicationsAdminClient';

export default async function AdminPublicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Публикации' }]} title="Публикации" description="Требуется авторизация." />
      </div>
    );
  }

  const list = await prisma.publication.findMany({
    orderBy: { publishAt: 'desc' },
  });

  const initialPublications = list.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    publishAt: p.publishAt.toISOString(),
    keywords: p.keywords,
    viewsCount: p.viewsCount,
    ratingSum: p.ratingSum,
    ratingCount: p.ratingCount,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Публикации' },
        ]}
        title="Публикации"
        description="Новости и объявления для главной и публичных страниц"
      />
      <PublicationsAdminClient initialPublications={initialPublications} />
    </div>
  );
}
