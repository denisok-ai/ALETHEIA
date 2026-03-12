'use client';

/**
 * Set new password — в локальном режиме (Prisma) недоступен.
 * Раньше использовался после перехода по ссылке Supabase recovery.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function UpdatePasswordPage() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-surface p-8 shadow-lg text-center">
      <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">Смена пароля</h1>
      <p className="mt-2 text-[var(--portal-text-muted)]">
        В локальном режиме смена пароля по ссылке недоступна. Обратитесь к администратору.
      </p>
      <Link href="/login" className="mt-6 inline-block">
        <Button variant="secondary">← Назад к входу</Button>
      </Link>
    </div>
  );
}
