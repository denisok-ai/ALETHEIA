/**
 * Admin: certificate catalog — list, download, filter, search, mass generate.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CertificatesAdminClient } from './CertificatesAdminClient';

export default async function AdminCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <PageHeader items={[{ label: 'Сертификаты' }]} title="Сертификаты" description="База данных недоступна." />
      </div>
    );
  }

  const [certs, courses] = await Promise.all([
    prisma.certificate.findMany({
      include: {
        course: { select: { id: true, title: true } },
        user: {
          select: { id: true, email: true, profile: { select: { displayName: true } } },
        },
      },
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.course.findMany({ select: { id: true, title: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const initialCertificates = certs.map((c) => ({
    id: c.id,
    certNumber: c.certNumber,
    courseId: c.courseId,
    courseTitle: c.course?.title ?? null,
    userId: c.userId,
    userEmail: c.user.email ?? null,
    displayName: c.user.profile?.displayName ?? null,
    issuedAt: c.issuedAt.toISOString(),
    revokedAt: c.revokedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { label: 'Сертификаты' },
        ]}
        title="Сертификаты"
        description="Каталог выданных сертификатов, скачивание PDF, массовая выдача"
      />
      <CertificatesAdminClient
        initialCertificates={initialCertificates}
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
      />
    </div>
  );
}
