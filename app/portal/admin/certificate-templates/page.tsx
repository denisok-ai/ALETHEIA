/**
 * Admin: certificate templates catalog — list and link to create/edit.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminCertificateTemplatesView } from './AdminCertificateTemplatesView';

export const metadata: Metadata = { title: 'Шаблоны сертификатов' };

export default async function AdminCertificateTemplatesPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const templates = await prisma.certificateTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { certificates: true } },
    },
  });

  const templatesData = templates.map((t) => ({
    id: t.id,
    name: t.name,
    courseTitle: t.course?.title ?? null,
    backgroundImageUrl: t.backgroundImageUrl,
    minScore: t.minScore,
    allowUserDownload: t.allowUserDownload,
    certificatesCount: t._count.certificates,
  }));

  return <AdminCertificateTemplatesView templates={templatesData} />;
}
