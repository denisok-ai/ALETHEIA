/**
 * Admin: полная карточка лида CRM.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { PageHeader } from '@/components/portal/PageHeader';
import { CrmLeadDetailClient, type LeadEmailDeliveryLogItem } from './CrmLeadDetailClient';
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

  let emailDeliveryLogs: LeadEmailDeliveryLogItem[] = [];
  if (lead.email?.trim()) {
    const addr = lead.email.trim();
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        module: string;
        entityId: string | null;
        recipient: string;
        subject: string | null;
        status: string;
        provider: string;
        createdAt: Date;
        errorMessage: string | null;
      }>
    >(Prisma.sql`
      SELECT id, module, entityId, recipient, subject, status, provider, createdAt, errorMessage
      FROM EmailDeliveryLog
      WHERE lower(recipient) = lower(${addr})
      ORDER BY datetime(createdAt) DESC
      LIMIT 40
    `);
    emailDeliveryLogs = rows.map((r) => ({
      id: r.id,
      module: r.module,
      entityId: r.entityId,
      recipient: r.recipient,
      subject: r.subject,
      status: r.status,
      provider: r.provider,
      createdAt: r.createdAt.toISOString(),
      errorMessage: r.errorMessage,
    }));
  }

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
    telegram_chat_id: lead.telegramChatId,
    telegram_username: lead.telegramUsername,
    funnel_segment: lead.funnelSegment,
    entry_source: lead.entrySource,
    followup_stage: lead.followupStage,
    last_bot_message_at: lead.lastBotMessageAt?.toISOString() ?? null,
    responded_at: lead.respondedAt?.toISOString() ?? null,
    qualified_at: lead.qualifiedAt?.toISOString() ?? null,
    qualify_reason: lead.qualifyReason,
    buy_intent_at: lead.buyIntentAt?.toISOString() ?? null,
    offer_sent_at: lead.offerSentAt?.toISOString() ?? null,
    unsubscribed_at: lead.unsubscribedAt?.toISOString() ?? null,
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
      <CrmLeadDetailClient initialLead={initial} emailDeliveryLogs={emailDeliveryLogs} />
    </div>
  );
}
