/**
 * Student: earned certificates — redesigned.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { StudentCertificatesView } from './StudentCertificatesView';

export const metadata: Metadata = { title: 'Сертификаты' };

export default async function StudentCertificatesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="portal-card p-6">
        <p className="text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    );
  }

  const list = await prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    include: {
      course: { select: { title: true } },
      template: { select: { allowUserDownload: true } },
    },
    orderBy: { issuedAt: 'desc' },
  });

  const items = list.map((c) => ({
    id: c.id,
    certNumber: c.certNumber,
    courseTitle: c.course?.title ?? 'Курс',
    issuedAt: c.issuedAt.toISOString(),
    allowDownload: c.template?.allowUserDownload !== false,
  }));

  return <StudentCertificatesView items={items} />;
}
