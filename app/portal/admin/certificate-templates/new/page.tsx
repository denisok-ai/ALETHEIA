/**
 * Admin: create new certificate template.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PageHeader } from '@/components/portal/PageHeader';
import { CertificateTemplateForm } from '../CertificateTemplateForm';

export default async function NewCertificateTemplatePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-text-muted">Доступ запрещён.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/certificates', label: 'Сертификаты' },
          { href: '/portal/admin/certificate-templates', label: 'Шаблоны сертификатов' },
          { label: 'Новый шаблон' },
        ]}
        title="Новый шаблон сертификата"
        description="Условия выдачи, привязка к курсу и образу, срок действия, нумерация."
      />
      <CertificateTemplateForm />
    </div>
  );
}
