'use client';

/**
 * Reset password request — Supabase Auth resetPasswordForEmail.
 */
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/login`,
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Ошибка отправки');
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-dark">Проверьте почту</h1>
        <p className="mt-2 text-text-muted">
          Ссылка для сброса пароля отправлена на {email}
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary font-medium hover:underline">
          Вернуться к входу
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-dark">Сброс пароля</h1>
      <p className="mt-1 text-sm text-text-muted">
        Введите email — отправим ссылку для смены пароля
      </p>
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
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Отправка…' : 'Отправить ссылку'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-muted">
        <Link href="/login" className="text-primary font-medium hover:underline">
          ← Назад к входу
        </Link>
      </p>
    </div>
  );
}
