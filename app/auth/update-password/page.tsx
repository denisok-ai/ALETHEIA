'use client';

/**
 * Set new password after recovery link. User lands here after /auth/callback with type=recovery.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      router.push('/portal/student/dashboard');
      router.refresh();
    } catch {
      setError('Ошибка обновления');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-dark">Новый пароль</h1>
      <p className="mt-1 text-sm text-text-muted">Введите новый пароль для входа</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">Новый пароль</Label>
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
        </div>
        <div>
          <Label htmlFor="confirm">Подтвердите пароль</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="mt-1"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Сохранение…' : 'Сохранить пароль'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-muted">
        <Link href="/login" className="text-primary hover:underline">
          ← Назад к входу
        </Link>
      </p>
    </div>
  );
}
