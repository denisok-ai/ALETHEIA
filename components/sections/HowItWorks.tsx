'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const steps = [
  {
    n: 1,
    title: 'Контакт',
    text: 'Вы касаетесь тела.',
  },
  {
    n: 2,
    title: 'Вопрос',
    text: 'Задаете вопрос.',
  },
  {
    n: 3,
    title: 'Ответ',
    text: 'Слабость или сила мышцы показывают готовность тела к взаимодействию.',
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="method" ref={ref} className="relative scroll-mt-24 bg-[var(--bg)] py-24 px-5 md:py-28 md:px-6">
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Метод</span>
          <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">Как это работает?</h2>
          <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
            Три шага взаимодействия с телом. Так вы получаете обратную связь без сложной аппаратуры.
          </p>
        </motion.div>

        <div className="mt-14 flex flex-col gap-8 md:flex-row md:items-stretch md:gap-4 lg:gap-6">
          {steps.map((step, i) => (
            <div key={step.n} className="flex flex-1 flex-col md:flex-row md:items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.08 + i * 0.1, duration: 0.45 }}
                className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-soft)] md:p-8"
              >
                <span
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-periwinkle/35 font-heading text-lg font-bold text-[var(--text)]"
                  aria-hidden
                >
                  {step.n}
                </span>
                <h3 className="font-heading text-xl font-semibold text-[var(--text)]">{step.title}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-[var(--text-muted)]">{step.text}</p>
              </motion.div>
              {i < steps.length - 1 && (
                <div
                  className="hidden shrink-0 items-center justify-center px-1 md:flex lg:px-2"
                  aria-hidden
                >
                  <ChevronRight className="h-8 w-8 text-[var(--text-soft)]" strokeWidth={1.5} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
