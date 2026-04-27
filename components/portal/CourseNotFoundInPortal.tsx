'use client';

/**
 * Курс отсутствует в БД — показываем в оболочке портала, без общей 404 главного сайта.
 */
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CourseNotFoundInPortal() {
  return (
    <div className="portal-card mx-auto max-w-lg p-8 text-center">
      <BookOpen className="mx-auto h-12 w-12 text-[var(--portal-text-soft)]" aria-hidden />
      <h1 className="mt-4 font-heading text-xl font-semibold text-[var(--portal-text)]">Курс не найден</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--portal-text-muted)]">
        В базе данных этого сайта нет курса с таким адресом. Если вы только что добавляли SCORM на другом
        компьютере или в другой базе, импортируйте пакет на этом сервере (админка → Курсы) или выполните
        скрипт импорта на проде.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/portal/student/courses"
          className={cn(buttonVariants({ variant: 'landingRose', size: 'default' }), 'rounded-lg')}
        >
          Мои курсы
        </Link>
        <Link
          href="/portal/student/dashboard"
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'default' }),
            'rounded-lg border border-[#E2E8F0] bg-transparent'
          )}
        >
          Дашборд
        </Link>
      </div>
    </div>
  );
}
