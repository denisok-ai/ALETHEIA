'use client';

/**
 * Reset password — в локальном режиме (Prisma) недоступен.
 * Для сброса пароля обратитесь к администратору.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg text-center">
      <h1 className="font-heading text-2xl font-bold text-dark">Сброс пароля</h1>
      <p className="mt-2 text-text-muted">
        В локальном режиме сброс пароля по email недоступен. Обратитесь к администратору для восстановления доступа.
      </p>
      <Link href="/login" className="mt-6 inline-block">
        <Button variant="secondary">← Назад к входу</Button>
      </Link>
    </div>
  );
}
