'use client';

/**
 * Публичная страница отписки от рассылок. Ссылка подставляется в %unsubscribe%.
 */
import { useState } from 'react';
import Link from 'next/link';

export default function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus('error');
      setMessage('Введите адрес электронной почты');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const r = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await r.json();
      if (r.ok) {
        setStatus('success');
        setMessage(data.message ?? 'Вы отписаны от рассылок.');
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Произошла ошибка');
      }
    } catch {
      setStatus('error');
      setMessage('Ошибка соединения');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <h1 className="font-heading text-2xl font-semibold text-[#f5f0e8]">
        Отписаться от рассылок
      </h1>
      <p className="mt-2 text-sm text-white/70">
        Укажите адрес электронной почты, с которого больше не хотите получать информационные рассылки школы AVATERRA.
      </p>

      {status === 'success' ? (
        <div className="mt-8 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-200">
          <p>{message}</p>
          <Link href="/" className="mt-3 inline-block text-sm text-primary underline">
            Вернуться на главную
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="unsub-email" className="block text-sm text-white/80">
              Email
            </label>
            <input
              id="unsub-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              className="mt-1 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={status === 'loading'}
              autoComplete="email"
            />
          </div>
          {status === 'error' && message && (
            <p className="text-sm text-red-300">{message}</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-dark transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === 'loading' ? 'Отправка…' : 'Отписаться'}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-white/50">
        <Link href="/" className="underline hover:text-white/70">
          На главную
        </Link>
      </p>
    </div>
  );
}
