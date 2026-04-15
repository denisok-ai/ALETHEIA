'use client';

/**
 * Кастомная страница выхода (русский интерфейс).
 * NextAuth pages.signOut указывает сюда — вместо дефолтной английской страницы.
 */
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SignOutPage() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const url = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
      await signOut({ callbackUrl: url, redirect: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark px-4">
      <div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg text-center max-w-md">
        <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Выход</h1>
        <p className="mt-2 text-[var(--portal-text-muted)]">
          Вы уверены, что хотите выйти из личного кабинета?
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={handleSignOut} disabled={loading}>
            {loading ? 'Выход…' : 'Выйти'}
          </Button>
          <Link href="/portal" className={cn(buttonVariants({ variant: 'secondary' }))}>
            Остаться
          </Link>
        </div>
      </div>
    </div>
  );
}
