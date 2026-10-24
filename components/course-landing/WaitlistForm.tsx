'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackGa4Lead } from '@/lib/analytics-events';

export const WAITLIST_SUCCESS_TEXT =
  'Спасибо! Мы записали вас в лист ожидания. Мастер свяжется, когда откроется запись — без обязательств с вашей стороны.';

/**
 * Лист ожидания личной работы с мастером. Пишет лид через POST /api/waitlist.
 * Обязательств и оплаты не предполагает: только очередь.
 */
export function WaitlistForm() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [question, setQuestion] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, question, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Не удалось отправить. Попробуйте ещё раз.');
        return;
      }
      trackGa4Lead('waitlist');
      setDone(true);
    } catch {
      setError('Нет связи с сервером. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[var(--text)] shadow-[var(--shadow-soft)]"
      >
        {WAITLIST_SUCCESS_TEXT}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto grid max-w-xl gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-8"
    >
      <div className="space-y-2">
        <Label htmlFor="waitlist-name">Имя</Label>
        <Input
          id="waitlist-name"
          autoComplete="name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitlist-contact">Телефон или e-mail</Label>
        <Input
          id="waitlist-contact"
          autoComplete="email"
          required
          maxLength={200}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitlist-question">Коротко: что хотите разобрать с мастером</Label>
        <textarea
          id="waitlist-question"
          maxLength={1000}
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--plum)]"
        />
      </div>
      {/* Honeypot: скрыто от людей */}
      <div className="hidden" aria-hidden>
        <label>
          Сайт
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" variant="landingRose" disabled={sending} className="w-full">
        {sending ? 'Отправляем…' : 'Записаться в лист ожидания'}
      </Button>
      <p className="text-xs leading-relaxed text-[var(--text-soft)]">
        Запись в лист ожидания ни к чему не обязывает. Персональные данные используются только для связи по вашему запросу.
      </p>
    </form>
  );
}
