'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';

const quote = 'Я передаю знания и опыт тем, кто готов меняться.';

export function Author() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      id="master"
      ref={ref}
      className="relative scroll-mt-24 overflow-hidden border-t border-[var(--border)] bg-[var(--surface)] py-24 px-5 md:py-28 md:px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center"
          >
            <TiltCard maxTilt={10} className="w-full max-w-sm">
              <div className="relative overflow-hidden rounded-2xl border-2 border-periwinkle/50 shadow-[var(--shadow-card)]">
                <Image
                  src="/images/tatiana/tatiana-about.png"
                  alt="Татьяна Стрельцова"
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

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block text-sm font-semibold uppercase tracking-widest text-plum">
              Основательница и ведущий мастер
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              Татьяна Стрельцова
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">22 года практики · более 15 000 консультаций</p>
            <p className="mt-7 text-[var(--text-muted)] leading-relaxed">
              С 2004 года я практикую кинезиологию и мышечный тест, помогая людям обрести внутренний баланс и силу жизни.
              «Аватера» — это уникальная методика, которая получила признание среди коллег и экспертов.
            </p>
            <p className="mt-6 border-l-4 border-rose pl-4 font-heading text-lg italic text-[var(--text)]">{quote}</p>
            <Link href="#contact" className="mt-8 inline-block">
              <Button variant="landingPlum">Связаться со мной</Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
