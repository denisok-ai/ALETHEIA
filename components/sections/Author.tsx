'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TiltCard } from '@/components/ui/TiltCard';
import { ABOUT_MASTER } from '@/lib/content/about-master';

export function Author() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      id="master"
      ref={ref}
      className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--surface)] py-14 px-4 sm:px-5 md:py-20 md:px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center"
          >
            <TiltCard maxTilt={10} className="w-full max-w-sm">
              <div className="relative overflow-hidden rounded-2xl border-2 border-periwinkle/50 shadow-[var(--shadow-card)]">
                <Image
                  src={ABOUT_MASTER.imageSrc}
                  alt={ABOUT_MASTER.imageAlt}
                  width={480}
                  height={640}
                  className="relative h-auto w-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.closest('div');
                    if (parent) parent.classList.add('min-h-[400px]', 'bg-[var(--lavender-light)]');
                  }}
                />
              </div>
            </TiltCard>
          </motion.div>

          <motion.article
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block text-sm font-semibold uppercase tracking-widest text-plum">
              {ABOUT_MASTER.eyebrow}
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              {ABOUT_MASTER.name}
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">{ABOUT_MASTER.subtitle}</p>
            {ABOUT_MASTER.paragraphs.map((p, i) => (
              <p key={p.slice(0, 24)} className={`text-[var(--text-muted)] leading-relaxed ${i === 0 ? 'mt-7' : 'mt-6'}`}>
                {p}
              </p>
            ))}
            <p className="mt-6 border-l-4 border-rose pl-4 font-heading text-lg italic text-[var(--text)]">
              {ABOUT_MASTER.quote}
            </p>
            <Link href="/#pricing" className={cn(buttonVariants({ variant: 'landingPlum' }), 'mt-8')}>
              Связаться со мной
            </Link>
          </motion.article>
        </div>
      </motion.div>
    </section>
  );
}
