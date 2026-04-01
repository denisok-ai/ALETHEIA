'use client';

/**
 * Полноэкранная карточка лида: контакты, источник, заметки, статус, конвертация, AI резюме.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, Sparkles, UserPlus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card } from '@/components/portal/Card';
import { formatPersonName } from '@/lib/format-person-name';

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
  created_at: string;
  updated_at: string;
};

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export function CrmLeadDetailClient({ initialLead }: { initialLead: CrmLeadDetail }) {
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
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--portal-text-muted)] hover:text-[#6366F1]"
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
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
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
