'use client';

/**
 * Установка пароля по одноразовой ссылке (после конвертации лида или восстановление).
 * URL: /set-password?token=...
 */
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Установка пароля</h1>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
          Ссылка недействительна: отсутствует токен. Запросите новую ссылку у администратора.
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button variant="secondary">← Назад к входу</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    const hasDigit = /\d/.test(password);
    const hasLetter = /[a-zA-Zа-яА-ЯёЁ]/.test(password);
    if (password.length < 8) {
      setError('Пароль не менее 8 символов');
      return;
    }
    if (!hasDigit) {
      setError('Пароль должен содержать хотя бы одну цифру');
      return;
    }
    if (!hasLetter) {
      setError('Пароль должен содержать хотя бы одну букву');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Ошибка установки пароля');
        setLoading(false);
        return;
      }
      router.push('/login?set=1');
      router.refresh();
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Установите пароль</h1>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Введите новый пароль для входа в личный кабинет.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">Новый пароль *</Label>
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
        <div>
          <Label htmlFor="confirm">Повторите пароль *</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="mt-1"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Сохранение…' : 'Сохранить пароль'}
        </Button>
      </form>
      <p className="mt-4 text-center">
        <Link href="/login" className="text-sm text-[var(--portal-accent)] hover:underline">
          ← Назад к входу
        </Link>
      </p>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center text-[var(--portal-text-muted)]">
        Загрузка…
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  );
}
