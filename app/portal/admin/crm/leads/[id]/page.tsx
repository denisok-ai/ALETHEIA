/**
 * Admin: полная карточка лида CRM.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { CrmLeadDetailClient } from './CrmLeadDetailClient';
import { formatPersonName } from '@/lib/format-person-name';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) return { title: 'Лид' };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { name: true } });
  if (!lead) return { title: 'Лид' };
  return { title: `CRM: ${formatPersonName(lead.name)}` };
}

export default async function CrmLeadDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || role !== 'admin') {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">Доступ запрещён.</p>
      </div>
    );
  }

  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) notFound();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();

  const initial = {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    notes: lead.notes,
    status: lead.status,
    source: lead.source,
    converted_to_user_id: lead.convertedToUserId,
    last_order_number: lead.lastOrderNumber ?? null,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString(),
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        items={[
          { href: '/portal/admin/dashboard', label: 'Дашборд' },
          { href: '/portal/admin/crm', label: 'CRM' },
          { label: formatPersonName(lead.name) },
        ]}
        title={formatPersonName(lead.name)}
        description={`Лид №${lead.id}`}
      />
      <CrmLeadDetailClient initialLead={initial} />
    </div>
  );
}
