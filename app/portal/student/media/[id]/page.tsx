/**
 * Student: view a single media resource. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canStudentAccessMedia } from '@/lib/media-access';
import { PageHeader } from '@/components/portal/PageHeader';
import { MediaViewClient } from './MediaViewClient';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const media = await prisma.media.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!media) return { title: 'Медиа' };
  return { title: (media.title ?? 'Медиа').slice(0, 60) };
}

export default async function StudentMediaViewPage({ params }: Props) {
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
  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      mediaGroups: { select: { groupId: true } },
      course: { select: { id: true, title: true } },
    },
  });
  if (!media) notFound();
  const allowed = await canStudentAccessMedia(userId, media);
  if (!allowed) notFound();

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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {media.courseId && media.course && (
              <Link
                href={`/portal/student/courses/${media.courseId}`}
                className="text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] hover:underline"
              >
                К курсу «{media.course.title.length > 36 ? `${media.course.title.slice(0, 36)}…` : media.course.title}»
              </Link>
            )}
            <Link href="/portal/student/media">
              <span className="text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] hover:underline">
                ← К медиатеке
              </span>
            </Link>
          </div>
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
          thumbnailUrl: media.thumbnailUrl,
        }}
      />
    </div>
  );
}
