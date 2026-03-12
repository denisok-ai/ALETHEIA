'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="space-y-6 max-w-2xl">
      {/* Форма */}
      <form onSubmit={handleSubmit} className="portal-card p-6">
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-4">Новое обращение</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Тема *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Кратко опишите вопрос"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="message">Сообщение</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Подробности (необязательно)"
              rows={4}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm
                text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)]
                focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Отправка…' : 'Отправить обращение'}
          </Button>
        </div>
      </form>

      {/* Список тикетов */}
      <section>
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-3">Мои обращения</h2>
        {tickets.length === 0 ? (
          <div className="portal-card p-8 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">Нет обращений</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => {
              const s = STATUS_MAP[t.status] ?? { label: t.status, cls: 'badge-neutral' };
              return (
                <li key={t.id}
                  className="portal-card flex items-center justify-between gap-4 p-4
                    hover:shadow-[var(--portal-shadow)] transition-shadow">
                  <div className="min-w-0">
                    <Link
                      href={`/portal/student/support/${t.id}`}
                      className="font-medium text-[var(--portal-text)] hover:text-[var(--portal-accent)] transition-colors"
                    >
                      {t.subject}
                    </Link>
                    <div className="mt-1.5 flex items-center gap-2">
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
                    className="text-xs text-[var(--portal-accent)] hover:underline shrink-0"
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
