'use client';

/**
 * Пустой список курсов — иконка lucide только на клиенте (см. next.config / дашборд студента).
 */
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export function StudentCoursesEmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="portal-card p-10 text-center">
      <BookOpen className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" aria-hidden />
      <h2 className="text-lg font-semibold text-[var(--portal-text)]">Курсов пока нет</h2>
      <p className="mt-2 text-[var(--portal-text-muted)] text-sm max-w-sm mx-auto">
        {isAdmin
          ? 'Создайте первый курс в Админка → Курсы.'
          : 'Запишитесь на курс, чтобы начать обучение.'}
      </p>
      <div className="mt-5">
        {isAdmin ? (
          <Link href="/portal/admin/courses" className="course-launch-btn primary inline-flex">
            Управление курсами
          </Link>
        ) : (
          <Link href="/#pricing" className="course-launch-btn gold inline-flex">
            Выбрать курс
          </Link>
        )}
      </div>
    </div>
  );
}
