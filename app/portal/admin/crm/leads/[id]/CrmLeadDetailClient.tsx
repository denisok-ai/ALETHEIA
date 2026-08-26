'use client';

/**
 * Полноэкранная карточка лида: контакты, источник, заметки, статус, конвертация, AI резюме.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, Sparkles, UserPlus, Mail } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card } from '@/components/portal/Card';
import { formatPersonName } from '@/lib/format-person-name';
import { CRM_LEAD_STATUSES, CRM_LEAD_STATUS_LABEL, type CrmLeadStatus } from '@/lib/crm-lead-status';

export type CrmLeadDetail = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  notes: string | null;
  status: string;
  source?: string | null;
  converted_to_user_id: string | null;
  last_order_number?: string | null;
  telegram_chat_id?: number | null;
  telegram_username?: string | null;
  funnel_segment?: string | null;
  entry_source?: string | null;
  followup_stage?: number;
  last_bot_message_at?: string | null;
  responded_at?: string | null;
  qualified_at?: string | null;
  qualify_reason?: string | null;
  buy_intent_at?: string | null;
  offer_sent_at?: string | null;
  unsubscribed_at?: string | null;
  audience?: string | null;
  created_at: string;
  updated_at: string;
};

/** Подписи аудитории лида (значения из детектора audience). */
const AUDIENCE_LABELS: Record<string, string> = {
  tense_body: 'Телесное напряжение / усталость',
  personal_crisis: 'Личная ситуация',
  specialist: 'Помогающий специалист',
  spiritual: 'Осознанность / духовный запрос',
  skeptic: 'Скептик',
};

/** Подписи сегментов воронки бота (значения в БД — info | warm | hot). */
const SEGMENT_LABEL: Record<string, string> = {
  info: 'холодный (за информацией)',
  warm: 'тёплый (есть вопросы)',
  hot: 'горячий (готов обсуждать участие)',
};

export type LeadEmailDeliveryLogItem = {
  id: string;
  module: string;
  entityId: string | null;
  recipient: string;
  subject: string | null;
  status: string;
  provider: string;
  createdAt: string;
  errorMessage: string | null;
};

export function CrmLeadDetailClient({
  initialLead,
  emailDeliveryLogs = [],
}: {
  initialLead: CrmLeadDetail;
  emailDeliveryLogs?: LeadEmailDeliveryLogItem[];
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [source, setSource] = useState(lead.source ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  async function patchLead(body: Record<string, unknown>) {
    const res = await fetch(`/api/portal/admin/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Ошибка');
    const L = data.lead as {
      notes: string | null;
      status: string;
      source: string | null;
      updatedAt: string;
    };
    return L;
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const updated = await patchLead({ notes: notes || null });
      setLead((p) => ({
        ...p,
        notes: updated.notes,
        updated_at: new Date(updated.updatedAt).toISOString(),
      }));
      toast.success('Заметки сохранены');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setSavingNotes(false);
  }

  async function handleSaveSource() {
    setSavingSource(true);
    try {
      const updated = await patchLead({ source: source.trim() || null });
      setLead((p) => ({
        ...p,
        source: updated.source,
        updated_at: new Date(updated.updatedAt).toISOString(),
      }));
      setSource(updated.source ?? '');
      toast.success('Источник обновлён');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setSavingSource(false);
  }

  async function handleStatus(status: string) {
    setUpdatingStatus(true);
    try {
      const updated = await patchLead({ status });
      setLead((p) => ({
        ...p,
        status: updated.status,
        updated_at: new Date(updated.updatedAt).toISOString(),
      }));
      toast.success('Статус обновлён');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setUpdatingStatus(false);
  }

  async function handleConvert() {
    setConvertOpen(false);
    setConverting(true);
    try {
      const res = await fetch('/api/portal/admin/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setLead((p) => ({
        ...p,
        status: 'converted',
        converted_to_user_id: data.userId,
      }));
      toast.success('Лид конвертирован в пользователя');
      if (data.userId) router.push(`/portal/admin/users/${data.userId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setConverting(false);
  }

  async function handleAiSummary() {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const context = [
        `Имя: ${lead.name}`,
        `Телефон: ${lead.phone}`,
        lead.email ? `Email: ${lead.email}` : null,
        lead.message ? `Сообщение: ${lead.message}` : null,
        lead.notes ? `Заметки: ${lead.notes}` : null,
        `Статус: ${lead.status}`,
        lead.source ? `Источник: ${lead.source}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction:
            'Сделай краткое резюме этого лида (2–3 предложения) и предложи следующий шаг для менеджера.',
          context,
          maxTokens: 300,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setAiSummary(data.content ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сгенерировать');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/portal/admin/crm"
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--portal-text-muted)] hover:text-[var(--portal-accent)]"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку CRM
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--portal-text)]">{formatPersonName(lead.name)}</h1>
          <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
            Лид №{lead.id} · создан{' '}
            {format(new Date(lead.created_at), 'dd.MM.yyyy HH:mm')} · обновлён{' '}
            {format(new Date(lead.updated_at), 'dd.MM.yyyy HH:mm')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={lead.status}
            onChange={(e) => handleStatus(e.target.value)}
            disabled={updatingStatus}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[var(--portal-text)]"
          >
            {CRM_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CRM_LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {!lead.converted_to_user_id && lead.email && (
            <Button variant="secondary" disabled={converting} onClick={() => setConvertOpen(true)} className="gap-1">
              <UserPlus className="h-4 w-4" />
              {converting ? '…' : 'Конвертировать'}
            </Button>
          )}
          {lead.converted_to_user_id && (
            <Link
              href={`/portal/admin/users/${lead.converted_to_user_id}`}
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Открыть пользователя
            </Link>
          )}
        </div>
      </div>

      <Card title="Контакты">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--portal-text-muted)]">Телефон</dt>
            <dd className="font-medium text-[var(--portal-text)]">{lead.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--portal-text-muted)]">Email</dt>
            <dd className="font-medium text-[var(--portal-text)]">{lead.email ?? '—'}</dd>
          </div>
          {lead.last_order_number && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--portal-text-muted)]">Связанный заказ (аналитика)</dt>
              <dd className="font-mono text-sm">{lead.last_order_number}</dd>
            </div>
          )}
        </dl>
      </Card>

      {lead.email && (
        <Card title="Исходящая почта по этому email" description="Общий журнал доставки (EmailDeliveryLog) для адреса лида — до и после конвертации в пользователя">
          {emailDeliveryLogs.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Записей журнала для этого адреса пока нет.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {emailDeliveryLogs.map((row) => (
                <li key={row.id} className="border-b border-[#E2E8F0]/80 pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                    <span className="text-xs text-[var(--portal-text-muted)]">
                      {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                    </span>
                    <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-xs">{row.module}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.provider}</span>
                    <span
                      className={
                        row.status === 'sent'
                          ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
                          : row.status === 'skipped'
                            ? 'rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900'
                            : 'rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800'
                      }
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 font-medium line-clamp-2">{row.subject ?? '—'}</p>
                  {row.errorMessage ? <p className="mt-1 text-xs text-red-700">{row.errorMessage}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {(lead.qualified_at || lead.buy_intent_at || lead.unsubscribed_at) && (
        <Card
          title="Автоквалификация"
          description="Бот двигает статус по фактам: контакт, интент покупки, оставленный телефон"
        >
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--portal-text-muted)]">Квалифицирован</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.qualified_at ? format(new Date(lead.qualified_at), 'dd.MM.yyyy HH:mm') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Интент покупки</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.buy_intent_at ? `🔥 ${format(new Date(lead.buy_intent_at), 'dd.MM HH:mm')}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Оффер отправлен</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.offer_sent_at ? format(new Date(lead.offer_sent_at), 'dd.MM HH:mm') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Отписался</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.unsubscribed_at ? format(new Date(lead.unsubscribed_at), 'dd.MM.yyyy') : 'нет'}
              </dd>
            </div>
            {lead.audience && (
              <div className="sm:col-span-2">
                <dt className="text-[var(--portal-text-muted)]">Запрос лида</dt>
                <dd className="text-[var(--portal-text)]">{AUDIENCE_LABELS[lead.audience] ?? lead.audience}</dd>
              </div>
            )}
          </dl>
          {lead.qualify_reason && (
            <p className="mt-3 whitespace-pre-wrap text-xs text-[var(--portal-text-muted)]">
              {lead.qualify_reason}
            </p>
          )}
        </Card>
      )}

      {lead.telegram_chat_id && (
        <Card
          title="Диалог в Telegram"
          description="Человек сам начал диалог с ботом — только поэтому боту можно писать ему"
        >
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--portal-text-muted)]">Chat ID</dt>
              <dd className="text-[var(--portal-text)]">{lead.telegram_chat_id}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Ник</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.telegram_username ? `@${lead.telegram_username}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Сегмент воронки</dt>
              <dd className="text-[var(--portal-text)]">{SEGMENT_LABEL[lead.funnel_segment ?? ''] ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Точка входа</dt>
              <dd className="text-[var(--portal-text)]">{lead.entry_source ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Догонов отправлено</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.followup_stage ?? 0} из 2
                {lead.last_bot_message_at
                  ? ` · последнее ${format(new Date(lead.last_bot_message_at), 'dd.MM HH:mm')}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--portal-text-muted)]">Ответил</dt>
              <dd className="text-[var(--portal-text)]">
                {lead.responded_at ? format(new Date(lead.responded_at), 'dd.MM.yyyy HH:mm') : 'ещё нет'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <Card title="Источник" description="Откуда пришёл лид (форма, лендинг, ручной ввод)">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Label className="text-[var(--portal-text-muted)]">Источник</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1" placeholder="например, contact_form" />
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={savingSource} onClick={() => handleSaveSource()}>
            <Pencil className="mr-1 h-4 w-4" />
            {savingSource ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
        {lead.entry_source && (
          // Метка из deep link: с какой страницы человек пришёл в бота или чат.
          <p className="mt-3 text-sm text-[var(--portal-text-muted)]">
            Точка входа: <span className="text-[var(--portal-text)]">{lead.entry_source}</span>
          </p>
        )}
      </Card>

      {lead.message && (
        <Card title="Сообщение с формы">
          <p className="whitespace-pre-wrap text-sm text-[var(--portal-text)]">{lead.message}</p>
        </Card>
      )}

      <Card title="Заметки менеджера">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[140px] w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)]"
          placeholder="Заметки по работе с лидом…"
        />
        <Button type="button" className="mt-3" size="sm" disabled={savingNotes} onClick={() => handleSaveNotes()}>
          {savingNotes ? 'Сохранение…' : 'Сохранить заметки'}
        </Button>
      </Card>

      <Card title="AI резюме" description="Краткий разбор по данным лида (DeepSeek / настройки AI)">
        <Button type="button" variant="secondary" size="sm" className="gap-1" disabled={aiLoading} onClick={handleAiSummary}>
          <Sparkles className="h-4 w-4" />
          {aiLoading ? 'Генерация…' : 'Сгенерировать'}
        </Button>
        {aiSummary && (
          <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm whitespace-pre-wrap text-[var(--portal-text)]">
            {aiSummary}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title="Конвертировать лида в пользователя?"
        description={
          lead.email
            ? `Будет создан аккаунт для «${formatPersonName(lead.name)}» (${lead.email}). Лид получит статус «Конвертирован».`
            : ''
        }
        confirmLabel="Конвертировать"
        variant="primary"
        onConfirm={handleConvert}
      />
    </div>
  );
}
