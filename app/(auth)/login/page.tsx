'use client';

/**
 * Login — NextAuth credentials.
 */
import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/portal';
  const justSetPassword = searchParams.get('set') === '1';
  const justVerified = searchParams.get('verified') === '1';

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
      router.push(redirect);
      router.refresh();
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
            <Link href="/reset-password" className="text-xs text-[#6366F1] hover:underline">
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
        <Link href="/register" className="font-medium text-[#6366F1] underline">
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
