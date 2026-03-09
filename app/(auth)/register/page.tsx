'use client';

/**
 * Register page — Supabase Auth signUp.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name || undefined } },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      router.refresh();
      router.push('/portal/student/dashboard');
    } catch {
      setError('Ошибка регистрации');
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-dark">Проверьте почту</h1>
        <p className="mt-2 text-text-muted">
          Ссылка для подтверждения отправлена на {email}
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary font-medium hover:underline">
          Перейти к входу
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-dark">Регистрация</h1>
      <p className="mt-1 text-sm text-text-muted">Создайте аккаунт для доступа к курсам</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Имя</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-text-muted">Не менее 6 символов</p>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Отправка…' : 'Зарегистрироваться'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-muted">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
