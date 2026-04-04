'use client';

import Link from 'next/link';
import { Gift } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COURSE_CHECKOUT_URL } from '@/lib/content/course-lynda-teaser';

/** Секция главной с тарифами и ссылкой на блок цен. */
export const COURSE_SALES_HREF = '/#pricing';

/** Реэкспорт: канонический URL в {@link COURSE_CHECKOUT_URL} (`lib/content/course-lynda-teaser.ts`). */
export { COURSE_CHECKOUT_URL };

type CourseCheckoutCTAProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

/**
 * Блок призыва к покупке курса: основная кнопка — `COURSE_CHECKOUT_URL`; тарифы на главной — вторичная ссылка.
 */
export function CourseCheckoutCTA({
  title = 'Готовы начать?',
  subtitle = 'Оформите доступ по ссылке ниже или посмотрите тарифы в блоке «Цены» на главной.',
  className = '',
}: CourseCheckoutCTAProps) {
  const href = COURSE_CHECKOUT_URL;
  const external = /^https?:\/\//i.test(href);
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
          <p className="mt-3 text-sm">
            <Link
              href={COURSE_SALES_HREF}
              className="font-medium text-plum underline decoration-plum/35 underline-offset-2 transition-colors hover:text-plum/90"
            >
              Тарифы и цены на главной
            </Link>
          </p>
        </div>
        <Link
          href={href}
          {...(external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {})}
          className={cn(
            buttonVariants({ variant: 'landingRose', size: 'lg' }),
            'w-full shrink-0 rounded-xl text-center sm:w-auto sm:min-w-[240px]'
          )}
        >
          Начать курс — 2 месяца практики
        </Link>
      </div>
    </aside>
  );
}
