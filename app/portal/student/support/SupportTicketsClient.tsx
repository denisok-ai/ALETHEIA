'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ticketCreateSchema } from '@/lib/validations/ticket';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

export function SupportTicketsClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ticketCreateSchema.safeParse({ subject, message });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Проверьте данные';
      setError(msg);
      toast.error(msg);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      if (data.ticket) {
        setTickets((prev) => [data.ticket, ...prev]);
        setSubject('');
        setMessage('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
    setSubmitting(false);
  }

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    open:        { label: 'Открыт',    cls: 'badge-warn' },
    in_progress: { label: 'В работе',  cls: 'badge-info' },
    resolved:    { label: 'Решён',     cls: 'badge-active' },
    closed:      { label: 'Закрыт',    cls: 'badge-neutral' },
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full">
      {/* Форма «Новое обращение» — на всю ширину */}
      <form
        onSubmit={handleSubmit}
        className="portal-card p-4 md:p-6 w-full"
      >
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-3 md:mb-4">Новое обращение</h2>
        <div className="space-y-3 md:space-y-4 max-w-2xl">
          <div>
            <Label htmlFor="subject">Тема *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Кратко опишите вопрос"
              maxLength={500}
              required
              className="mt-1 min-h-10 touch-manipulation w-full"
            />
          </div>
          <div>
            <Label htmlFor="message">Сообщение</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Подробности (необязательно)"
              maxLength={10000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm
                text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)]
                focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent min-h-[80px]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <Button type="submit" variant="primary" disabled={submitting} className="min-h-10 touch-manipulation">
            {submitting ? 'Отправка…' : 'Отправить обращение'}
          </Button>
        </div>
      </form>

      {/* Блок «Мои обращения» — под формой */}
      <section className="w-full min-w-0">
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-2 md:mb-3">Мои обращения</h2>
        {tickets.length === 0 ? (
          <div className="portal-card p-6 md:p-8 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">Нет обращений</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-3">
            {tickets.map((t) => {
              const s = STATUS_MAP[t.status] ?? { label: t.status, cls: 'badge-neutral' };
              return (
                <li
                  key={t.id}
                  className="portal-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 hover:shadow-[var(--portal-shadow)] transition-shadow min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/portal/student/support/${t.id}`}
                      className="font-medium text-[var(--portal-text)] hover:text-[var(--portal-accent)] transition-colors line-clamp-2"
                    >
                      {t.subject}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`status-badge ${s.cls}`}>{s.label}</span>
                      <time className="text-xs text-[var(--portal-text-soft)]">
                        {new Date(t.created_at).toLocaleString('ru', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </div>
                  <Link
                    href={`/portal/student/support/${t.id}`}
                    className="text-sm text-[var(--portal-accent)] hover:underline shrink-0 font-medium self-start sm:self-center min-h-9 flex items-center touch-manipulation"
                  >
                    Открыть →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
