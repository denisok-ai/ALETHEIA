'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { COURSE_CHECKOUT_URL } from '@/lib/content/course-lynda-teaser';
import { BRAND_SCHOOL_LINE } from '@/lib/brand';

export function Hero() {
  const checkoutHref = COURSE_CHECKOUT_URL;
  const checkoutExternal = /^https?:\/\//i.test(checkoutHref);
  const reduceMotion = useReducedMotion();
  const t = (duration: number, delay = 0) =>
    reduceMotion ? { duration: 0 } : { duration, delay };

  return (
    <section
      id="hero"
      className="relative flex min-h-[min(100dvh,880px)] flex-col overflow-hidden bg-[var(--bg)]"
    >
      <div className="relative z-10 flex flex-1 flex-col justify-center px-4 py-14 md:px-8 md:py-16 lg:py-20">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10">
          <header className="w-full max-w-xl shrink-0 lg:max-w-[28rem]">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.45)}
              className="text-sm font-semibold uppercase tracking-[0.2em] text-plum"
            >
              {BRAND_SCHOOL_LINE}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.5, 0.05)}
              className="mt-4 font-heading text-4xl font-bold leading-[1.15] text-[var(--text)] sm:text-5xl"
            >
              Ваше тело знает ответ. Научитесь его понимать.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.5, 0.1)}
              className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--text)]"
            >
              Курс по прикладному мышечному тестированию. Узнайте истинную причину боли и стресса за 30 секунд без
              дорогостоящих обследований.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.5, 0.15)}
              className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            >
              <Link href="#pricing" className="inline-flex">
                <Button size="lg" variant="landingRose" className="min-w-[200px] rounded-xl px-6">
                  Записаться на бесплатный пробный урок
                </Button>
              </Link>
              <Link
                href={checkoutHref}
                {...(checkoutExternal ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {})}
                className="inline-flex"
              >
                <Button size="lg" variant="landingSoft" className="min-w-[160px] rounded-xl px-6">
                  Купить курс
                </Button>
              </Link>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(0.5, 0.2)}
              className="mt-4 text-center sm:text-left"
            >
              <Link
                href="/blog"
                className="text-sm font-medium text-plum underline decoration-plum/40 underline-offset-4 transition-colors hover:text-plum/90 hover:decoration-plum/70"
              >
                Читать блог
              </Link>
            </motion.p>
          </header>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.5, 0.08)}
            className="relative w-full max-w-[min(100%,340px)] shrink-0 sm:max-w-[380px] lg:max-w-[420px]"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-periwinkle/50 bg-[var(--surface)] shadow-[var(--shadow-card)]">
              <Image
                src="/images/tatiana/tatiana-hero.png"
                alt="Татьяна Стрельцова - основательница школы кинезиологии AVATERRA, 22 года практики"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) min(340px, 100vw), 420px"
                priority
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
