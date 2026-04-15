'use client';

/**
 * Set new password — в локальном режиме (Prisma) недоступен.
 * Раньше использовался после перехода по ссылке Supabase recovery.
 */
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function UpdatePasswordPage() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg text-center">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Смена пароля</h1>
      <p className="mt-2 text-[var(--portal-text-muted)]">
        В локальном режиме смена пароля по ссылке недоступна. Обратитесь к администратору.
      </p>
      <Link href="/login" className={cn(buttonVariants({ variant: 'secondary' }), 'mt-6')}>
        ← Назад к входу
      </Link>
    </div>
  );
}
