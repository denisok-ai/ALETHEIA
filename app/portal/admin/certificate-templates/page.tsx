/**
 * Admin: certificate templates catalog — list and link to create/edit.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Шаблоны сертификатов' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CertificateTemplatesTableClient } from './CertificateTemplatesTableClient';
import { Button } from '@/components/ui/button';
import { LayoutTemplate, Plus } from 'lucide-react';

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

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/certificates', label: 'Сертификаты' },
          { label: 'Шаблоны сертификатов' },
        ]}
        title="Шаблоны сертификатов"
        description="Условия выдачи (minScore, requiredStatus), срок действия, нумерация, флаг «Электронная версия доступна пользователям»."
        actions={
          <Link
            href="/portal/admin/certificate-templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#6366F1] px-3 py-2 text-sm font-medium text-white hover:bg-[#4F46E5] shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Добавить шаблон
          </Link>
        }
      />
      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Нет шаблонов"
            description="Создайте шаблон для привязки к курсу: подложка, координаты текста, условия выдачи, срок действия, доступность скачивания."
            icon={<LayoutTemplate className="h-10 w-10" />}
            action={
              <Link href="/portal/admin/certificate-templates/new">
                <Button>Добавить шаблон</Button>
              </Link>
            }
          />
        ) : (
          <CertificateTemplatesTableClient templates={templatesData} />
        )}
      </Card>
    </div>
  );
}
