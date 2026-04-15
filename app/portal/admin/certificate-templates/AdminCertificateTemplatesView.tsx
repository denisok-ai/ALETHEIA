'use client';

import Link from 'next/link';
import { LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CertificateLayoutPreviewLinks } from '@/components/portal/CertificateLayoutPreviewLinks';
import { CertificateTemplatesTableClient, type CertTemplateRow } from './CertificateTemplatesTableClient';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PortalAccentAddLink } from '@/components/portal/PortalAccentAddLink';
import { PORTAL_PATH } from '@/lib/portal-paths';

export function AdminCertificateTemplatesView({ templates }: { templates: CertTemplateRow[] }) {
  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: PORTAL_PATH.adminDashboard, label: 'Дашборд' },
          { href: '/portal/admin/certificates', label: 'Сертификаты' },
          { label: 'Шаблоны сертификатов' },
        ]}
        title="Шаблоны сертификатов"
        description="Условия выдачи (minScore, requiredStatus), срок действия, нумерация, флаг «Электронная версия доступна пользователям»."
        actions={
          <PortalAccentAddLink href="/portal/admin/certificate-templates/new">Добавить шаблон</PortalAccentAddLink>
        }
      />
      <CertificateLayoutPreviewLinks />
      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Нет шаблонов"
            description="Создайте шаблон для привязки к курсу: подложка, координаты текста, условия выдачи, срок действия, доступность скачивания."
            icon={<LayoutTemplate className="h-10 w-10" />}
            action={
              <Link href="/portal/admin/certificate-templates/new" className={cn(buttonVariants())}>
                Добавить шаблон
              </Link>
            }
          />
        ) : (
          <CertificateTemplatesTableClient templates={templates} />
        )}
      </Card>
    </div>
  );
}
