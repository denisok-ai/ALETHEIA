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

  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={handleSubmit} className="max-w-xl rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Новое обращение</h2>
        <div className="mt-4 space-y-4">
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
              className="mt-1 w-full rounded-lg border border-border px-4 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Отправка…' : 'Отправить'}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="text-lg font-semibold text-dark">Мои обращения</h2>
        <ul className="mt-3 space-y-2">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-white p-4"
            >
              <Link href={`/portal/student/support/${t.id}`} className="font-medium text-dark text-primary hover:underline">
                {t.subject}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    t.status === 'open'
                      ? 'bg-amber-100 text-amber-800'
                      : t.status === 'resolved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {t.status}
                </span>
                <time>{new Date(t.created_at).toLocaleString('ru')}</time>
              </div>
            </li>
          ))}
        </ul>
        {tickets.length === 0 && (
          <p className="mt-2 text-text-muted">Нет обращений.</p>
        )}
      </section>
    </div>
  );
}
