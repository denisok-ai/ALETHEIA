/**
 * Student: view a single media resource (player + view count increment).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { MediaViewClient } from './MediaViewClient';

export default async function StudentMediaViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return (
      <div>
        <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { href: '/portal/student/media', label: 'Медиатека' }, { label: 'Просмотр' }]} />
        <p className="mt-4 text-text-muted">Войдите в аккаунт для просмотра.</p>
      </div>
    );
  }

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) notFound();

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { href: '/portal/student/media', label: 'Медиатека' },
          { label: media.title },
        ]}
      />
      <h1 className="font-heading text-xl font-bold text-dark">{media.title}</h1>
      {media.description && (
        <p className="text-sm text-text-muted">{media.description}</p>
      )}
      <MediaViewClient mediaId={id} media={media} />
    </div>
  );
}
