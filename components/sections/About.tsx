'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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
    <section
      id="why"
      ref={ref}
      className="relative scroll-mt-24 border-t border-[var(--border)] bg-[var(--surface)] py-24 px-5 md:py-28 md:px-6"
    >
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">О школе</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Более 20 лет мы помогаем обрести баланс
          </h2>
          <p className="mt-5 leading-relaxed text-[var(--text-muted)]">
            Более 15 000 человек прошли наши программы. Кинезиология и работа с подсознанием — в формате, который
            подходит именно вам.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 + i * 0.05, duration: 0.45 }}
              className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-plum/30 hover:bg-[var(--lavender-light)] md:p-7"
            >
              <card.icon className="mb-4 h-8 w-8 text-plum" aria-hidden />
              <h3 className="font-heading text-lg font-semibold text-[var(--text)]">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{card.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
