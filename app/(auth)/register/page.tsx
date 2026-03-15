'use client';

/**
 * Register — локальная БД (Prisma).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Пароль не менее 8 символов');
      return;
    }
    if (!/\d/.test(password)) {
      setError('Пароль должен содержать хотя бы одну цифру');
      return;
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password)) {
      setError('Пароль должен содержать хотя бы одну букву');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Ошибка регистрации');
        setLoading(false);
        return;
      }
      router.push('/login?registered=1');
      router.refresh();
    } catch {
      setError('Ошибка регистрации');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Регистрация</h1>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Создайте аккаунт для доступа к курсам</p>
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
            minLength={8}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Не менее 8 символов, цифра и буква</p>
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
      <p className="mt-4 text-center text-sm text-[var(--portal-text-muted)]">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-medium text-[#6366F1] underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
