'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';
import { Sparkles, Heart, Shield, Users } from 'lucide-react';

const cards = [
  {
    title: 'Индивидуальный подход',
    text: 'Глубокое понимание связи тела и психики, ориентированное на ваши запросы.',
    icon: Heart,
  },
  {
    title: 'Опыт и признание',
    text: 'Мастера школы — практики с многолетним стажем и признанной методикой в России и за рубежом.',
    icon: Shield,
  },
  {
    title: 'Проверенные методики',
    text: 'Программы на основе мышечного тестирования и работы с подсознанием.',
    icon: Sparkles,
  },
  {
    title: 'Поддержка на пути',
    text: 'Сопровождение на всех этапах — от первой консультации до курса.',
    icon: Users,
  },
];

export function About() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="why" ref={ref} className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-lavender-light/40 via-bg to-lavender/30" />
      <motion.div
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, rotateX: 18 }}
        animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] to-[#1e3a5f] lg:col-span-2 lg:h-72"
          >
            <Image
              src="/images/thematic/about-path.png"
              alt="Путь к гармонии — кинезиология и подсознание"
              fill
              className="object-cover opacity-90"
              sizes="(max-width: 1024px) 100vw, 40vw"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </motion.div>
          <div className="lg:col-span-3">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              className="block text-sm font-semibold uppercase tracking-widest text-accent"
            >
              О курсе
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 }}
              className="mt-2 font-heading text-3xl font-semibold text-dark sm:text-4xl"
            >
              Более 20 лет мы помогаем обрести баланс
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-2xl text-text-muted"
            >
              Более 15 000 человек прошли наши программы. Кинезиология и работа с подсознанием — в формате, который подходит именно вам.
            </motion.p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 80 }}
            >
              <TiltCard maxTilt={8} className="h-full">
                <div className="rounded-2xl border border-lavender-soft/50 bg-white/90 p-6 backdrop-blur-xl transition-all hover:border-accent/40 hover:bg-lavender-light/30 h-full flex flex-col">
                  <card.icon className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-heading text-lg font-semibold text-dark">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted flex-1">{card.text}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
