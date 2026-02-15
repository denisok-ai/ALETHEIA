'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { PaymentModal } from '@/components/PaymentModal';

export type TariffItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
};

const tariffs: TariffItem[] = [
  {
    id: 'consult',
    name: 'Индивидуальная консультация',
    price: 5000,
    description: 'Диагностика и коррекция через мышечное тестирование.',
    features: ['1 сессия', 'Кинезиология один на один'],
  },
  {
    id: 'group',
    name: 'Групповой тренинг',
    price: 3000,
    description: 'Психосоматика и работа с подсознанием в группе.',
    features: ['1 занятие', 'В группе'],
  },
  {
    id: 'course',
    name: 'Курс ALETHEIA',
    price: 25000,
    description: '10 занятий: основы кинезиологии и мышечного тестирования.',
    features: ['10 занятий', 'Полное погружение', 'Поддержка на пути'],
    popular: true,
  },
  {
    id: 'online',
    name: 'Онлайн-консультация',
    price: 3500,
    description: 'Удалённая сессия с мастером школы.',
    features: ['1 сессия', 'Из любой точки мира'],
  },
];

export function Pricing() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [modalTariff, setModalTariff] = useState<TariffItem | null>(null);

  return (
    <>
      <section id="pricing" ref={ref} className="relative py-28 px-5 bg-lavender-light/30 md:py-32 md:px-6">
        <motion.div
          style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
          initial={{ opacity: 0, rotateX: 18 }}
          animate={isInView ? { opacity: 1, rotateX: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-6xl"
        >
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            className="block text-sm font-semibold uppercase tracking-widest text-accent"
          >
            Тарифы
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.05 }}
            className="mt-2 font-heading text-3xl font-semibold text-dark sm:text-4xl"
          >
            Купить курс или записаться на консультацию
          </motion.h2>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {tariffs.map((tariff, i) => (
              <motion.div
                key={tariff.id}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 80 }}
                className="h-full"
              >
                <TiltCard maxTilt={6} className="h-full">
                  <div
                    className={`relative h-full rounded-2xl border p-7 transition-shadow md:p-8 ${
                      tariff.popular
                        ? 'border-accent/50 bg-gradient-to-b from-accent/10 to-bg-cream shadow-xl shadow-accent/20'
                        : 'border-border bg-white hover:border-accent/40 hover:shadow-xl hover:shadow-black/10'
                    }`}
                    style={{
                      boxShadow: tariff.popular
                        ? '0 25px 50px -12px rgba(166, 139, 91, 0.25), 0 12px 24px -8px rgba(0,0,0,0.08)'
                        : '0 12px 24px -8px rgba(0,0,0,0.06)',
                    }}
                  >
                    {tariff.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-sm font-bold text-white">
                        Хит продаж
                      </span>
                    )}
                    <h3 className="font-heading text-xl font-semibold text-dark">
                      {tariff.name}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">{tariff.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-text-muted">
                      {tariff.features.map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                    <p className="mt-6 text-3xl font-bold text-accent">
                      {tariff.price.toLocaleString('ru-RU')} ₽
                    </p>
                    <Button
                      variant={tariff.popular ? 'primary' : 'secondary'}
                      className="mt-6 w-full shadow-[0_0_20px_rgba(166,139,91,0.25)] hover:shadow-[0_0_28px_rgba(166,139,91,0.35)]"
                      onClick={() => setModalTariff(tariff)}
                    >
                      Купить
                    </Button>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <PaymentModal
        isOpen={!!modalTariff}
        onClose={() => setModalTariff(null)}
        tariff={modalTariff ?? undefined}
      />
    </>
  );
}
