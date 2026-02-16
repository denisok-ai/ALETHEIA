'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { Typewriter } from '@/components/ui/Typewriter';

const ParticleBackground = dynamic(
  () => import('@/components/3d/ParticleBackground').then((m) => m.ParticleBackground),
  { ssr: false, loading: () => null }
);

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-violet-200/90 via-violet-300/80 to-indigo-900"
    >
      {/* Фон: кристаллы/геометрия — лёгкий слой для глубины */}
      <div className="absolute inset-0 z-0 opacity-30">
        <Image
          src="/images/hero/hero-bg.png"
          alt=""
          fill
          className="object-cover object-center mix-blend-soft-light"
          sizes="100vw"
          priority
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* 3D-анимация: частицы поверх фона */}
      <div className="absolute inset-0 z-[1] pointer-events-none opacity-60">
        <ParticleBackground transparentBackground />
      </div>

      {/* Контент: карточка слева, изображение справа с перекрытием */}
      <div className="relative z-10 flex min-h-screen flex-col justify-center px-4 py-28 md:px-8 md:py-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-0">
          {/* Текст в карточке — тёмный полупрозрачный фиолет, как на референсе */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 w-full max-w-lg shrink-0 rounded-3xl bg-violet-900/60 px-6 py-8 shadow-2xl backdrop-blur-md md:px-8 md:py-9 lg:mr-[-2rem]"
          >
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/95">
              Phygital школа мышечного тестирования
            </p>
            <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-white sm:text-5xl min-h-[1.2em]">
              <Typewriter text="AVATERRA" speed={120} delay={400} cursor />
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/95 lg:text-lg">
              Школа сомаватаров. Тело не врет.
            </p>
            <div className="mt-8">
              <Link href="#pricing">
                <Button
                  size="lg"
                  className="min-w-[200px] rounded-xl bg-white font-semibold text-gray-900 shadow-lg hover:bg-white/95"
                >
                  Купить курс
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Изображение с ключом — перекрывает карточку, закруглённая рамка */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative z-20 w-full max-w-md shrink-0 lg:max-w-lg"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 sm:aspect-[3/4]">
              <Image
                src="/images/thematic/hero-banner.png"
                alt="Путь к внутренней гармонии — школа подсознания"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 45vw"
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

      {/* Блок с автором — фото основательницы с 3D tilt */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="relative z-10 mt-12 flex justify-center pb-16 md:mt-16 md:pb-20"
      >
        <TiltCard maxTilt={8} className="w-full max-w-[300px] sm:max-w-[340px]">
          <div className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-violet-900/30 shadow-2xl backdrop-blur-sm">
            <Image
              src="/images/tatiana/tatiana-hero.png"
              alt="Татьяна Стрельцова — основательница школы AVATERRA"
              width={340}
              height={420}
              className="h-auto w-full object-cover"
              loading="lazy"
              fetchPriority="low"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.closest('div');
                if (parent) parent.classList.add('min-h-[280px]', 'bg-violet-800/40');
              }}
            />
          </div>
        </TiltCard>
      </motion.div>
    </section>
  );
}
