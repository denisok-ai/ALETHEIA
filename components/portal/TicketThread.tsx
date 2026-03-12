'use client';

/**
 * Shared ticket thread: messages list, reply form. Optional: status change, assign manager (for manager view).
 */
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export interface TicketMessage {
  role: string;
  content: string;
  at: string;
}

/** Шаблоны быстрых ответов для менеджера (задача 7.3). */
const QUICK_REPLY_TEMPLATES: { label: string; body: string }[] = [
  { label: '— Выберите шаблон —', body: '' },
  { label: 'Доступ откроется в течение 24 часов', body: 'Здравствуйте!\n\nДоступ к курсу откроется в течение 24 часов. Если не откроется — напишите нам ещё раз.\n\nС уважением,' },
  { label: 'Проверьте раздел «Мои курсы»', body: 'Здравствуйте!\n\nПроверьте, пожалуйста, раздел «Мои курсы» в личном кабинете — доступ должен быть уже открыт. Войдите под тем же email, что указывали при оплате.\n\nС уважением,' },
  { label: 'Мы уточняем информацию', body: 'Здравствуйте!\n\nМы уточняем информацию по вашему запросу. Ответим в ближайшее время.\n\nС уважением,' },
  { label: 'Регистрация с email оплаты', body: 'Здравствуйте!\n\nЗарегистрируйтесь на портале с тем же email, что указывали при оплате — после регистрации курс автоматически появится в разделе «Мои курсы».\n\nС уважением,' },
];

export interface TicketThreadProps {
  ticketId: string;
  subject: string;
  status: string;
  managerId: string | null;
  userDisplayName: string;
  managerDisplayName: string | null;
  initialMessages: TicketMessage[];
  orderNumber?: string | null;
  /** Ссылка «Заказ» ведёт в раздел Оплаты только для админа; для менеджера показывается только текст */
  canLinkOrderToPayments?: boolean;
  canChangeStatus?: boolean;
  canAssign?: boolean;
  managers?: { id: string; label: string }[];
  backHref: string;
  backLabel: string;
}

export function TicketThread({
  ticketId,
  subject,
  status: initialStatus,
  managerId: initialManagerId,
  userDisplayName,
  managerDisplayName: initialManagerDisplayName,
  initialMessages,
  orderNumber,
  canLinkOrderToPayments = false,
  canChangeStatus,
  canAssign,
  managers = [],
  backHref,
  backLabel,
}: TicketThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [managerId, setManagerId] = useState(initialManagerId);
  const [updatingMeta, setUpdatingMeta] = useState(false);

  async function handleSend() {
    const content = reply.trim();
    if (!content) return;
    setSending(true);
    try {
      const r = await fetch(`/api/portal/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Ошибка');
      setMessages((prev) => [...prev, data.message]);
      setReply('');
      toast.success('Сообщение отправлено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setSending(false);
  }

  async function handleStatusChange(newStatus: string) {
    if (!canChangeStatus) return;
    setUpdatingMeta(true);
    try {
      const r = await fetch(`/api/portal/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error('Ошибка');
      setStatus(newStatus);
      toast.success('Статус обновлён');
    } catch {
      toast.error('Не удалось обновить статус');
    }
    setUpdatingMeta(false);
  }

  async function handleAssign(newManagerId: string | null) {
    if (!canAssign) return;
    setUpdatingMeta(true);
    try {
      const r = await fetch(`/api/portal/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: newManagerId }),
      });
      if (!r.ok) throw new Error('Ошибка');
      setManagerId(newManagerId);
      toast.success('Менеджер назначен');
    } catch {
      toast.error('Не удалось назначить');
    }
    setUpdatingMeta(false);
  }

  const statusCls =
    status === 'open' ? 'badge-warn' : status === 'resolved' || status === 'closed' ? 'badge-active' : 'badge-info';
  const statusLabel =
    status === 'open' ? 'Открыт' : status === 'in_progress' ? 'В работе' : status === 'resolved' ? 'Решён' : 'Закрыт';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={backHref} className="text-sm font-medium text-[#6366F1] hover:underline">
          {backLabel}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--portal-text)]" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
          {subject}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--portal-text-muted)]">
          <span>Автор: {userDisplayName}</span>
          {managerId && <span>Менеджер: {managers.find((m) => m.id === managerId)?.label ?? managerId}</span>}
          {orderNumber && (
            canLinkOrderToPayments ? (
              <Link
                href={`/portal/admin/payments?search=${encodeURIComponent(orderNumber)}`}
                className="text-[#6366F1] hover:underline"
                title="Открыть заказ в разделе Оплаты"
              >
                Заказ: {orderNumber}
              </Link>
            ) : (
              <span title="Привязанный заказ (нет доступа после оплаты)">Заказ: {orderNumber}</span>
            )
          )}
          <span className={`status-badge ${statusCls}`}>{statusLabel}</span>
        </div>
        {(canChangeStatus || canAssign) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {canChangeStatus && (
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-[var(--portal-text)]">Статус</Label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingMeta}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
                >
                  <option value="open">Открыт</option>
                  <option value="in_progress">В работе</option>
                  <option value="resolved">Решён</option>
                  <option value="closed">Закрыт</option>
                </select>
              </div>
            )}
            {canAssign && managers.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-[var(--portal-text)]">Менеджер</Label>
                <select
                  value={managerId ?? ''}
                  onChange={(e) => handleAssign(e.target.value || null)}
                  disabled={updatingMeta}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm min-w-[160px] text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
                >
                  <option value="">— Не назначен</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="portal-card p-5">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Переписка</h2>
        <ul className="mt-3 space-y-3">
          {messages.length === 0 ? (
            <li className="text-sm text-[var(--portal-text-muted)]">Пока нет сообщений.</li>
          ) : (
            messages.map((m, i) => (
              <li
                key={`${m.at}-${i}`}
                className={`rounded-lg p-3 ${
                  m.role === 'manager'
                    ? 'ml-4 bg-[#EEF2FF] border-l-2 border-[#6366F1]'
                    : 'mr-4 bg-[#F8FAFC] border-l-2 border-[#E2E8F0]'
                }`}
              >
                <p className="text-xs font-medium text-[var(--portal-text-muted)]">
                  {m.role === 'user' ? userDisplayName : (initialManagerDisplayName ?? 'Менеджер')} · {format(new Date(m.at), 'dd.MM.yyyy HH:mm')}
                </p>
                <p className="mt-1 text-sm text-[var(--portal-text)] whitespace-pre-wrap">{m.content}</p>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4">
          {(canChangeStatus || canAssign) && (
            <div className="mb-2">
              <Label htmlFor="quick-reply" className="text-sm font-medium text-[var(--portal-text-muted)]">Шаблон ответа</Label>
              <select
                id="quick-reply"
                className="mt-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] min-w-[280px]"
                value=""
                onChange={(e) => {
                  const opt = e.target.selectedIndex;
                  if (opt <= 0) return;
                  const t = QUICK_REPLY_TEMPLATES[opt];
                  if (t?.body) setReply((prev) => (prev ? `${prev}\n\n${t.body}` : t.body));
                  e.target.selectedIndex = 0;
                }}
              >
                {QUICK_REPLY_TEMPLATES.map((t, i) => (
                  <option key={i} value={t.body}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
          <Label htmlFor="reply" className="text-sm font-medium text-[var(--portal-text)]">Ответ</Label>
          <textarea
            id="reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Введите сообщение..."
            rows={3}
            className="mt-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
          />
          <Button variant="primary" className="mt-2" onClick={handleSend} disabled={sending || !reply.trim()}>
            {sending ? 'Отправка…' : 'Отправить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
