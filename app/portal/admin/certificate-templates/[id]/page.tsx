/**
 * Admin: edit certificate template or delete.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { CertificateTemplateForm } from '../CertificateTemplateForm';
import { CertificateTemplateDelete } from '../CertificateTemplateDelete';

export default async function CertificateTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
      </div>
    );
  }

  const { id } = await params;
  const template = await prisma.certificateTemplate.findUnique({
    where: { id },
    include: { _count: { select: { certificates: true } } },
  });
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/certificates', label: 'Сертификаты' },
          { href: '/portal/admin/certificate-templates', label: 'Шаблоны сертификатов' },
          { label: template.name },
        ]}
        title={template.name}
        description="Подложка, координаты текста, условия выдачи, срок действия, доступность скачивания."
      />
      <CertificateTemplateForm
        templateId={template.id}
        initial={{
          name: template.name,
          backgroundImageUrl: template.backgroundImageUrl,
          textMapping: template.textMapping,
          courseId: template.courseId,
          minScore: template.minScore,
          requiredStatus: template.requiredStatus ?? '',
          validityDays: template.validityDays,
          numberingFormat: template.numberingFormat,
          allowUserDownload: template.allowUserDownload,
        }}
      />
      {template._count.certificates === 0 && (
        <CertificateTemplateDelete templateId={template.id} templateName={template.name} />
      )}
    </div>
  );
}
