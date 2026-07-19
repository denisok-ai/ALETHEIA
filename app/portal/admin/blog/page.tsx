/**
 * Admin: статьи блога сайта.
 */
import type { Metadata } from 'next';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { BlogAdminClient, type BlogRow } from './BlogAdminClient';

export const metadata: Metadata = { title: 'Блог' };
export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const auth = await requireAdminSession();
  if (!auth) {
    return (
      <PageHeader items={[{ label: 'Блог' }]} title="Блог" description="Требуется доступ администратора." />
    );
  }

  const list = await prisma.blogPost.findMany({
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      source: true,
      sourceUrl: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  const initialPosts: BlogRow[] = list.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-4">
      <PageHeader
        items={[{ href: '/portal/admin/dashboard', label: 'Дашборд' }, { label: 'Блог' }]}
        title="Блог"
        description="Статьи блога сайта. Черновики не видны посетителям."
      />
      <BlogAdminClient initialPosts={initialPosts} />
    </div>
  );
}
