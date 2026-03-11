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

export interface TicketThreadProps {
  ticketId: string;
  subject: string;
  status: string;
  managerId: string | null;
  userDisplayName: string;
  managerDisplayName: string | null;
  initialMessages: TicketMessage[];
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

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-primary hover:underline">
          {backLabel}
        </Link>
        <h1 className="mt-2 font-heading text-xl font-bold text-dark">{subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span>Автор: {userDisplayName}</span>
          {managerId && <span>Менеджер: {managers.find((m) => m.id === managerId)?.label ?? managerId}</span>}
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              status === 'open' ? 'bg-amber-100 text-amber-800' : status === 'resolved' || status === 'closed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {status}
          </span>
        </div>
        {(canChangeStatus || canAssign) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {canChangeStatus && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Статус</Label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingMeta}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
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
                <Label className="text-sm">Менеджер</Label>
                <select
                  value={managerId ?? ''}
                  onChange={(e) => handleAssign(e.target.value || null)}
                  disabled={updatingMeta}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm min-w-[160px]"
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

      <div className="rounded-xl border border-border bg-white p-4">
        <h2 className="text-lg font-semibold text-dark">Переписка</h2>
        <ul className="mt-3 space-y-3">
          {messages.length === 0 ? (
            <li className="text-sm text-text-muted">Пока нет сообщений.</li>
          ) : (
            messages.map((m, i) => (
              <li
                key={`${m.at}-${i}`}
                className={`rounded-lg p-3 ${
                  m.role === 'manager' ? 'ml-4 bg-primary/5 border-l-2 border-primary' : 'mr-4 bg-bg-cream'
                }`}
              >
                <p className="text-xs font-medium text-text-muted">
                  {m.role === 'user' ? userDisplayName : (initialManagerDisplayName ?? 'Менеджер')} · {format(new Date(m.at), 'dd.MM.yyyy HH:mm')}
                </p>
                <p className="mt-1 text-sm text-dark whitespace-pre-wrap">{m.content}</p>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4">
          <Label htmlFor="reply">Ответ</Label>
          <textarea
            id="reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Введите сообщение..."
            rows={3}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          <Button className="mt-2" onClick={handleSend} disabled={sending || !reply.trim()}>
            {sending ? 'Отправка…' : 'Отправить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
