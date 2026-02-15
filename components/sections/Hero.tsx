'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { Typewriter } from '@/components/ui/Typewriter';
import { ChevronDown } from 'lucide-react';

const ParticleBackground = dynamic(
  () => import('@/components/3d/ParticleBackground').then((m) => m.ParticleBackground),
  { ssr: false, loading: () => <div className="absolute inset-0 -z-10 bg-bg-cream" /> }
);

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '35%']);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-20"
    >
      <div className="absolute inset-0 z-0">
        <Image src="/images/hero/hero-bg.png" alt="" fill className="object-cover opacity-40" sizes="100vw" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <motion.div style={{ y: backgroundY }} className="absolute inset-0 z-0">
        <ParticleBackground />
      </motion.div>

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-0 overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-2">
        {/* Левая часть: тематический баннер (мистический стиль) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="relative h-[280px] bg-gradient-to-br from-[#1a2744] via-[#1e3a5f] to-[#0f3460] lg:h-[420px]"
        >
          <Image
            src="/images/thematic/hero-banner.png"
            alt="Путь к внутренней гармонии — школа подсознания"
            fill
            className="object-cover opacity-90"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a2744]/80 via-transparent to-transparent" aria-hidden />
        </motion.div>

        {/* Правая часть: текст на лавандовом фоне (как на референсе) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="flex flex-col justify-center rounded-r-3xl bg-lavender px-8 py-10 lg:rounded-l-none lg:px-12 lg:py-14"
        >
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-accent">
            Школа подсознания и мышечного тестирования
          </p>
          <h1 className="font-heading text-3xl font-bold leading-tight text-dark sm:text-4xl lg:text-5xl min-h-[1.2em]">
            <Typewriter text="ALETHEIA" speed={120} delay={400} cursor />
          </h1>
          <p className="mt-4 text-base text-text-muted lg:text-lg">
            Откройте для себя путь к внутренней гармонии и глубокому пониманию взаимосвязи тела и духа в нашей уникальной школе.
          </p>
          <div className="mt-8">
            <Link href="#pricing">
              <Button
                variant="primary"
                size="lg"
                className="min-w-[240px] shadow-[0_0_32px_rgba(166,139,91,0.3)] hover:shadow-[0_0_48px_rgba(166,139,91,0.4)] transition-shadow duration-300"
              >
                Купить курс
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Фото основательницы — с 3D tilt и выраженной глубиной */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 mx-auto mt-10 flex justify-center"
      >
        <TiltCard maxTilt={8} className="w-full max-w-[320px] sm:max-w-sm">
          <div
            className="relative overflow-hidden rounded-2xl border-2 border-accent/25 bg-lavender-light/50"
            style={{
              boxShadow: '0 25px 50px -12px rgba(166,139,91,0.35), 0 12px 24px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(166,139,91,0.1)',
            }}
          >
            <Image
              src="/images/tatiana/tatiana-hero.png"
              alt="Татьяна Стрельцова — основательница школы ALETHEIA"
              width={320}
              height={400}
              className="h-auto w-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.closest('div');
                if (parent) parent.classList.add('min-h-[300px]');
              }}
            />
          </div>
        </TiltCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <a
          href="#why"
          className="flex flex-col items-center gap-1 text-text-muted hover:text-accent transition-colors"
          aria-label="Прокрутить вниз"
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-8 w-8" />
          </motion.span>
          <span className="text-xs uppercase tracking-widest">Вниз</span>
        </a>
      </motion.div>
    </section>
  );
}
