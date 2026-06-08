'use client';

import Link from 'next/link';
import { Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  /** Дисклеймер в одну строку под CTA (опционально). */
  disclaimer?: string;
};

/** Финальная CTA-секция с трастом и дисклеймером — закрывающий аккорд лендинга. */
export function FinalCTA({ title, subtitle, ctaPrimary, ctaSecondary, disclaimer }: Props) {
  return (
    <section className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--lavender-light)] py-10 px-5 md:py-14 md:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <Sparkles className="mx-auto h-9 w-9 text-rose" aria-hidden />
        <h2 className="mt-4 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-[var(--text-muted)]">{subtitle}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={ctaPrimary.href}
            className={cn(buttonVariants({ size: 'lg', variant: 'landingRose' }), 'min-w-[240px] rounded-xl px-6')}
          >
            {ctaPrimary.label}
          </Link>
          {ctaSecondary ? (
            <Link
              href={ctaSecondary.href}
              className={cn(buttonVariants({ size: 'lg', variant: 'landingSoft' }), 'min-w-[200px] rounded-xl px-6')}
            >
              {ctaSecondary.label}
            </Link>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-sm text-[var(--text-muted)] sm:flex-row sm:flex-wrap">
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-plum" aria-hidden /> Безопасная оплата
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-plum" aria-hidden /> Защита данных
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-plum" aria-hidden /> Поддержка кураторов
          </span>
        </div>

        {disclaimer ? (
          <p className="mt-6 text-xs leading-relaxed text-[var(--text-soft)]">{disclaimer}</p>
        ) : null}
      </div>
    </section>
  );
}
