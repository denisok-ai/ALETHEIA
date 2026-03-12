/**
 * Student: view a single media resource. Portal design.
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
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
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          items={[
            { href: '/portal/student/dashboard', label: 'Дашборд' },
            { href: '/portal/student/media', label: 'Медиатека' },
            { label: 'Просмотр' },
          ]}
          title="Просмотр"
          description="Войдите в аккаунт для доступа к материалам."
        />
      </div>
    );
  }

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[
          { href: '/portal/student/dashboard', label: 'Дашборд' },
          { href: '/portal/student/media', label: 'Медиатека' },
          { label: media.title },
        ]}
        title={media.title}
        description={media.description ?? undefined}
        actions={
          <Link href="/portal/student/media">
            <span className="text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] hover:underline">
              ← К медиатеке
            </span>
          </Link>
        }
      />
      <MediaViewClient
        mediaId={id}
        media={{
          id: media.id,
          title: media.title,
          fileUrl: media.fileUrl,
          mimeType: media.mimeType,
          allowDownload: media.allowDownload,
          type: media.type,
        }}
      />
    </div>
  );
}
