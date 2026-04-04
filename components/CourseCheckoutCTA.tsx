'use client';

import Link from 'next/link';
import { Gift } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Секция главной с тарифами и кнопкой «Купить» (модалка оплаты). */
export const COURSE_SALES_HREF = '/#pricing';

type CourseCheckoutCTAProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

/**
 * Блок призыва к покупке курса: переход к тарифам на главной.
 */
export function CourseCheckoutCTA({
  title = 'Готовы начать?',
  subtitle = 'Курс «Навыки мышечного тестирования» — выберите тариф и оформите доступ на сайте школы.',
  className = '',
}: CourseCheckoutCTAProps) {
  return (
    <aside
      className={`rounded-2xl border border-plum/25 bg-[var(--lavender-light)] p-6 shadow-[var(--shadow-soft)] md:p-8 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-plum">
            <Gift className="h-5 w-5 shrink-0" aria-hidden />
            <h2 className="font-heading text-lg font-semibold text-[var(--text)] sm:text-xl">{title}</h2>
          </div>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href={COURSE_SALES_HREF}
          className={cn(
            buttonVariants({ variant: 'landingRose', size: 'lg' }),
            'w-full shrink-0 rounded-xl sm:w-auto sm:min-w-[240px]'
          )}
        >
          Начать курс — 2 месяца практики
        </Link>
      </div>
    </aside>
  );
}
