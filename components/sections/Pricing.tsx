'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { PaymentModal } from '@/components/PaymentModal';

export type TariffItem = {
  id: string;
  slug?: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  /** Обложка с витрины (админка → Товары) */
  imageUrl?: string | null;
};

const FALLBACK_TARIFFS: TariffItem[] = [
  {
    id: 'kod-tela-start',
    slug: 'kod-tela-start',
    name: 'Код тела: введение в мышечное тестирование',
    price: 0,
    description:
      'Бесплатный мини-курс для знакомства с методом: снять страх «не получится», дать быстрый «вау»-эффект и мягко подвести к платным тарифам.',
    features: [
      '3–4 коротких видео по 7–15 минут',
      'Видео 1 — знакомство: кинезиология, стресс, скрытые эмоции',
      'Видео 2 — демонстрация теста из практики',
      'Видео 3 — практика: простой само-тест «Да/Нет» на вашем теле',
      'Видео 4 — полный путь в школе и ограниченное предложение на «Профи» и «ВИП»',
    ],
  },
  {
    id: 'avaterra-praktik',
    slug: 'avaterra-praktik',
    name: 'AVATERRA: Практик',
    price: 25_000,
    description:
      'Тариф «Профи»: фундаментальный навык мышечного тестирования — на себе, для близких или старта работы с клиентами.',
    features: [
      'Полный дистанционный курс: введение, основы тестирования, подсознание, практика и интеграция',
      'Доп. видео: библиотека эмоций, ошибки новичков, скрипты и алгоритмы',
      'Регулярные Zoom с сертифицированными кураторами школы',
      'Q&A, отработка техники под наблюдением эксперта, разбор ваших ситуаций',
    ],
    popular: true,
  },
  {
    id: 'avaterra-master-vip',
    slug: 'avaterra-master-vip',
    name: 'AVATERRA: Мастер. Менторство Татьяны Стрельцовой',
    price: 69_000,
    description:
      'Тариф «ВИП»: глубокое погружение, авторские нюансы и личное время основателя с 22-летним опытом.',
    features: [
      'Всё из тарифа «Профи»: курс и базовые дополнительные материалы',
      'Закрытые онлайн-встречи с Татьяной Стрельцовой для узкой группы',
      'Супервизия и коррекция техники напрямую от автора методики',
      'Секретный модуль: продвинутые техники, сложные кейсы, монетизация навыка',
    ],
  },
];

export function Pricing() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [products, setProducts] = useState<TariffItem[]>(FALLBACK_TARIFFS);
  const [modalTariff, setModalTariff] = useState<TariffItem | null>(null);

  useEffect(() => {
    fetch('/api/shop/products', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.products;
        if (Array.isArray(list) && list.length > 0) {
          setProducts(
            list.map(
              (p: {
                slug: string;
                name: string;
                price: number;
                description: string;
                features?: string[];
                imageUrl?: string | null;
              }) => ({
                id: p.slug,
                slug: p.slug,
                name: p.name,
                price: p.price,
                description: p.description || p.name,
                features: Array.isArray(p.features) ? p.features : [p.description || p.name],
                popular: p.slug === 'avaterra-praktik',
                imageUrl: p.imageUrl ?? null,
              })
            )
          );
        }
      })
      .catch(() => {});
  }, []);

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
            className="mt-2 font-heading text-3xl font-semibold text-[var(--portal-text)] sm:text-4xl"
          >
            От бесплатного знакомства до менторства основателя
          </motion.h2>

          <div className="mt-14 grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
            {products.map((tariff, i) => (
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
                        : 'border-[#E2E8F0] bg-white hover:border-[#6366F1]/40 hover:shadow-xl hover:shadow-black/10'
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
                    {tariff.imageUrl ? (
                      <div className="mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#F1F5F9]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tariff.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <h3 className="font-heading text-xl font-semibold text-[var(--portal-text)]">
                      {tariff.name}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--portal-text-muted)]">{tariff.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-[var(--portal-text-muted)]">
                      {tariff.features.map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                    <p className="mt-6 text-3xl font-bold text-accent">
                      {tariff.price <= 0 ? 'Бесплатно' : `${tariff.price.toLocaleString('ru-RU')} ₽`}
                    </p>
                    <Button
                      variant={tariff.popular ? 'primary' : 'secondary'}
                      className="mt-6 w-full shadow-[0_0_20px_rgba(166,139,91,0.25)] hover:shadow-[0_0_28px_rgba(166,139,91,0.35)]"
                      onClick={() => setModalTariff(tariff)}
                    >
                      {tariff.price <= 0 ? 'Получить бесплатно' : 'Купить'}
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
