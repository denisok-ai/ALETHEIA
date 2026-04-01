'use client';

/**
 * Login — NextAuth credentials.
 * После входа редирект сразу на дашборд по роли (минуя /portal), чтобы избежать 404 при race condition.
 */
import { useState, Suspense } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function getDashboardByRole(role: string): string {
  if (role === 'admin') return '/portal/admin/dashboard';
  if (role === 'manager') return '/portal/manager/dashboard';
  return '/portal/student/dashboard';
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect') ?? '/portal';
  const justSetPassword = searchParams.get('set') === '1';
  const justVerified = searchParams.get('verified') === '1';
  const justRegistered = searchParams.get('registered') === '1';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Неверный email или пароль' : res.error);
        setLoading(false);
        return;
      }
      // Редирект сразу на дашборд по роли — избегаем 404 на /portal при первом входе
      // Сессия может появиться с задержкой — опрашиваем до 5 сек
      let session = await getSession();
      for (let i = 0; i < 25 && !session?.user; i++) {
        await new Promise((r) => setTimeout(r, 200));
        session = await getSession();
      }
      const role = (session?.user as { role?: string })?.role ?? 'user';
      const target = redirectParam === '/portal' ? getDashboardByRole(role) : redirectParam;
      // Небольшая задержка, чтобы cookie успел установиться перед навигацией
      await new Promise((r) => setTimeout(r, 100));
      window.location.href = target;
    } catch {
      setError('Ошибка входа');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Вход</h1>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Войдите в личный кабинет</p>
      {justSetPassword && (
        <p className="mt-3 rounded-lg bg-green-50 text-green-800 text-sm p-3">Пароль успешно установлен. Войдите, используя email и новый пароль.</p>
      )}
      {justVerified && (
        <p className="mt-3 rounded-lg bg-green-50 text-green-800 text-sm p-3">Email подтверждён. Войдите в личный кабинет.</p>
      )}
      {justRegistered && (
        <p className="mt-3 rounded-lg bg-green-50 text-green-800 text-sm p-3">Аккаунт создан. Войдите, используя email и пароль.</p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Пароль</Label>
            <Link href="/reset-password" className="text-xs text-[var(--portal-accent)] hover:underline">
              Забыли пароль?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--portal-text-muted)]">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-medium text-[var(--portal-accent)] underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg">Загрузка…</div>}>
      <LoginForm />
    </Suspense>
  );
}
