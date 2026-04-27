'use client';

/**
 * Сброс пароля: ввод email → письмо со ссылкой на /set-password?token=…
 */
import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success !== false) setSent(true);
    } catch {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Проверьте почту</h1>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
          Если аккаунт с указанным email существует, вы получите письмо со ссылкой для установки нового пароля. Ссылка действует 48 часов.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: 'secondary' }), 'mt-6')}>
          ← Назад к входу
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-lg">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Сброс пароля</h1>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Введите email, указанный при регистрации. Мы отправим ссылку для установки нового пароля.
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
            placeholder="your@email.com"
            className="mt-1"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Отправка…' : 'Отправить ссылку'}
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
