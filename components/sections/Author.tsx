'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { Typewriter } from '@/components/ui/Typewriter';

const quote = 'Я передаю знания и опыт тем, кто готов меняться.';

export function Author() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="master" ref={ref} className="relative py-28 px-5 overflow-hidden md:py-32 md:px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg-soft to-bg" />
      <div className="absolute inset-0 opacity-30">
        <Image src="/images/author/author-bg.png" alt="" fill className="object-cover" sizes="100vw" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center"
          >
            <TiltCard maxTilt={10} className="w-full max-w-sm">
              <div
                className="relative overflow-hidden rounded-2xl border-2 border-accent/30"
                style={{
                  boxShadow: '0 32px 64px -16px rgba(166,139,91,0.4), 0 16px 32px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(212,175,55,0.15)',
                }}
              >
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent/25 to-transparent blur-md opacity-80" aria-hidden />
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
                    if (parent) parent.classList.add('min-h-[400px]', 'bg-bg-cream');
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
            <span className="block text-sm font-semibold uppercase tracking-widest text-accent">
              Основательница и ведущий мастер
            </span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-dark sm:text-4xl">
              Татьяна Стрельцова
            </h2>
            <p className="mt-2 text-text-muted">22 года практики · более 15 000 консультаций</p>
            <p className="mt-7 text-text-muted leading-relaxed">
              С 2004 года я практикую кинезиологию и мышечный тест, помогая людям обрести внутренний баланс и силу жизни. AVATERRA — это уникальная методика, которая получила признание среди коллег и экспертов.
            </p>
            {isInView && (
              <p className="mt-6 border-l-4 border-accent pl-4 font-heading text-lg italic text-dark">
                <Typewriter text={quote} speed={50} delay={800} cursor={false} />
              </p>
            )}
            <Link href="#contact" className="mt-8 inline-block">
              <Button variant="primary">Связаться со мной</Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
