'use client';

/**
 * Страница для авторизованных пользователей, у которых email не подтверждён.
 * Доступ к порталу блокируется до подтверждения.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export default function VerifyEmailRequiredPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.user) {
          router.push('/login?redirect=/verify-email-required');
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  async function handleResend() {
    setResending(true);
    setResendSuccess(false);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      if (res.ok) {
        setResendSuccess(true);
      } else {
        const data = await res.json();
        alert(data.error ?? 'Ошибка отправки');
      }
    } catch {
      alert('Ошибка соединения');
    }
    setResending(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 font-body">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <Mail className="mx-auto h-12 w-12 text-[var(--portal-accent)]" />
        <h1 className="mt-4 font-heading text-2xl font-bold text-[var(--portal-text)]">
          Подтвердите email
        </h1>
        {loading ? (
          <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Проверка…</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
              Для доступа к личному кабинету необходимо подтвердить email. Перейдите по ссылке из письма, которое мы отправили при регистрации.
            </p>
            <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
              Не получили письмо? Проверьте папку «Спам» или запросите повторную отправку.
            </p>
            <div className="mt-6 space-y-3">
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full"
              >
                {resending ? 'Отправка…' : 'Отправить письмо повторно'}
              </Button>
              {resendSuccess && (
                <p className="text-sm text-green-600">Письмо отправлено. Проверьте почту.</p>
              )}
              <Button variant="ghost" onClick={() => signOut({ callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login' })} className="w-full">
                Выйти
              </Button>
            </div>
          </>
        )}
      </div>
      <p className="mt-6 text-center">
        <Link href="/login" className="text-sm text-[var(--portal-accent)] hover:underline">
          ← Назад к входу
        </Link>
      </p>
    </div>
  );
}
