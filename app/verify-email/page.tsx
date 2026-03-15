'use client';

/**
 * Подтверждение email по токену из письма.
 * URL: /verify-email?token=...
 */
import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Ошибка подтверждения');
          setStatus('error');
          return;
        }
        setStatus('success');
        setTimeout(() => router.push('/login?verified=1'), 2000);
      })
      .catch(() => {
        setError('Ошибка соединения');
        setStatus('error');
      });
  }, [token, router]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Подтверждение email</h1>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
          Ссылка недействительна: отсутствует токен. Запросите новое письмо.
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button variant="secondary">← Назад к входу</Button>
        </Link>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Подтверждение email</h1>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Проверка…</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Email подтверждён</h1>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
          Перенаправление на страницу входа…
        </p>
        <Link href="/login?verified=1" className="mt-6 inline-block">
          <Button variant="secondary">Войти</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Подтверждение email</h1>
      <p className="mt-2 text-sm text-red-600">{error}</p>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Токен недействителен или истёк. Запросите новое письмо.
      </p>
      <Link href="/login" className="mt-6 inline-block">
        <Button variant="secondary">← Назад к входу</Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center text-[var(--portal-text-muted)]">
          Загрузка…
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
