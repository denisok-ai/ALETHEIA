'use client';

/**
 * Login page — Supabase Auth signInWithPassword.
 */
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(err === 'missing_token' ? 'Недействительная или устаревшая ссылка' : err === 'config' ? 'Ошибка конфигурации' : decodeURIComponent(err));
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      router.push('/portal/student/dashboard');
      router.refresh();
    } catch {
      setError('Ошибка входа');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-dark">Вход</h1>
      <p className="mt-1 text-sm text-text-muted">Войдите в личный кабинет</p>
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
          <Label htmlFor="password">Пароль</Label>
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
      <p className="mt-4 text-center text-sm text-text-muted">
        Нет аккаунта?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Зарегистрироваться
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-text-muted">
        <Link href="/reset-password" className="text-primary hover:underline">
          Забыли пароль?
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">Загрузка…</div>}>
      <LoginForm />
    </Suspense>
  );
}
