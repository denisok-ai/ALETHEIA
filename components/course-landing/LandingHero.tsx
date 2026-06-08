'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LandingHeroTrust = { value: string; label: string };

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  badges: ReadonlyArray<string>;
  trust?: ReadonlyArray<LandingHeroTrust>;
  imageSrc: string;
  imageAlt: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  /** Расположение картинки: справа (по умолчанию) или фоном за текстом. */
  variant?: 'card' | 'background';
};

/** Hero-секция продающего лендинга курса. Дизайн совпадает с главной (`Hero.tsx`). */
export function LandingHero({
  eyebrow,
  title,
  subtitle,
  description,
  badges,
  trust,
  imageSrc,
  imageAlt,
  ctaPrimary,
  ctaSecondary,
  variant = 'card',
}: Props) {
  const reduceMotion = useReducedMotion();
  const t = (duration: number, delay = 0) =>
    reduceMotion ? { duration: 0 } : { duration, delay };

  const isBackground = variant === 'background';

  return (
    <section className="relative overflow-hidden bg-[var(--bg)] pt-4 md:pt-6">
      {isBackground ? (
        <div className="absolute inset-0 -z-0">
          <Image
            src={imageSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/70 to-[var(--bg)]" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-8 md:px-8 md:pb-10 lg:flex-row lg:items-center lg:gap-10 lg:pb-12">
        <header className="w-full max-w-2xl shrink-0 lg:max-w-[34rem]">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.45)}
            className="text-sm font-semibold uppercase tracking-[0.22em] text-plum"
          >
            {eyebrow}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.05)}
            className="mt-4 font-heading text-3xl font-bold leading-[1.15] text-[var(--text)] sm:text-4xl md:text-5xl"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.1)}
            className="mt-5 text-lg leading-relaxed text-[var(--text)]"
          >
            {subtitle}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.14)}
            className="mt-3 text-base leading-relaxed text-[var(--text-muted)]"
          >
            {description}
          </motion.p>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.18)}
            className="mt-6 grid gap-2.5 sm:grid-cols-2"
          >
            {badges.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-plum" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.22)}
            className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          >
            <Link
              href={ctaPrimary.href}
              className={cn(buttonVariants({ size: 'lg', variant: 'landingRose' }), 'min-w-[220px] rounded-xl px-6')}
            >
              {ctaPrimary.label}
            </Link>
            {ctaSecondary ? (
              <Link
                href={ctaSecondary.href}
                className={cn(buttonVariants({ size: 'lg', variant: 'landingSoft' }), 'min-w-[180px] rounded-xl px-6')}
              >
                {ctaSecondary.label}
              </Link>
            ) : null}
          </motion.div>

          {trust?.length ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.5, 0.26)}
              className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-5 sm:gap-6"
            >
              {trust.map((t) => (
                <div key={t.label} className="text-left">
                  <p className="font-heading text-xl font-semibold text-[var(--text)] sm:text-2xl">{t.value}</p>
                  <p className="mt-1 text-xs leading-snug text-[var(--text-muted)] sm:text-sm">{t.label}</p>
                </div>
              ))}
            </motion.div>
          ) : null}
        </header>

        {!isBackground ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.08)}
            className="relative w-full max-w-[min(100%,420px)] shrink-0 sm:max-w-[460px] lg:max-w-[480px]"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-periwinkle/50 bg-[var(--surface)] shadow-[var(--shadow-card)]">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                priority
                sizes="(max-width: 1024px) min(420px, 100vw), 480px"
                className="object-cover object-center"
              />
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
