'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { PaymentModal } from '@/components/PaymentModal';
import { ANALYTICS, trackGa4AndYm } from '@/lib/analytics-events';

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
    name: 'Тело знает всё: введение в мышечное тестирование',
    price: 0,
    description:
      'Бесплатный мини-курс для знакомства с методом: снять страх «не получится», дать быстрый «вау»-эффект и мягко подвести к платным тарифам.',
    features: [
      '3–4 коротких видео по 7–15 минут',
      'Видео 1 — знакомство: кинезиология, стресс, скрытые эмоции',
      'Видео 2 — демонстрация теста из практики',
      'Видео 3 — практика: простой само-тест «Да/Нет» на вашем теле',
      'Видео 4 — полный путь в школе и предложение тарифов «Практик» и VIP',
    ],
  },
  {
    id: 'avaterra-praktik',
    slug: 'avaterra-praktik',
    name: '«Аватера»: Практик',
    price: 25_000,
    description:
      'Тариф «Практик»: фундаментальный навык мышечного тестирования — на себе, для близких или старта работы с клиентами.',
    features: [
      'Полный дистанционный курс: введение, основы тестирования, подсознание, методы работы с подсознанием',
      'Доп. видео: библиотека эмоций, ошибки новичков, скрипты и алгоритмы',
      'Регулярные Zoom с сертифицированными кураторами школы',
      'Вопросы и ответы, отработка техники под наблюдением эксперта, разбор ваших ситуаций',
    ],
    popular: true,
  },
  {
    id: 'avaterra-master-vip',
    slug: 'avaterra-master-vip',
    name: '«Аватера»: Мастер. Наставничество Татьяны Стрельцовой',
    price: 69_000,
    description:
      'Тариф VIP: глубокое погружение, авторские нюансы и личное время основателя с 22-летним опытом.',
    features: [
      'Всё из тарифа «Практик»: курс и базовые дополнительные материалы',
      'Закрытые онлайн-встречи с Татьяной Стрельцовой для узкой группы',
      'Обучение диагностике и применение в авторских техниках',
      'Закрытый модуль: продвинутые техники, сложные кейсы, интеграция системы в жизнь',
    ],
  },
];

export function Pricing() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const pricingScrollTracked = useRef(false);
  const [products, setProducts] = useState<TariffItem[]>(FALLBACK_TARIFFS);
  const [modalTariff, setModalTariff] = useState<TariffItem | null>(null);

  useEffect(() => {
    if (!isInView || pricingScrollTracked.current) return;
    pricingScrollTracked.current = true;
    trackGa4AndYm(ANALYTICS.SCROLL_PRICING, ANALYTICS.SCROLL_PRICING);
  }, [isInView]);

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
      <section
        id="pricing"
        ref={ref}
        className="relative scroll-mt-24 border-t border-[var(--border)] bg-[var(--lavender-light)] py-24 px-5 md:py-28 md:px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl"
        >
          <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Тарифы</span>
          <h2 className="mt-2 max-w-3xl font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
            Купить курс или записаться на консультацию
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--text-muted)] leading-relaxed">
            Выберите формат: бесплатное знакомство, полный курс или наставничество. Оплата и детали — в модальном окне.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
            {products.map((tariff, i) => (
              <motion.div
                key={tariff.id}
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.06 + i * 0.07, duration: 0.45 }}
                className="h-full"
              >
                <TiltCard maxTilt={6} className="h-full">
                  <div
                    className={`relative h-full rounded-2xl border p-7 transition-shadow md:p-8 ${
                      tariff.popular
                        ? 'border-rose/50 bg-[var(--surface)] shadow-xl shadow-rose/15'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-plum/35 hover:shadow-xl hover:shadow-black/5'
                    }`}
                    style={{
                      boxShadow: tariff.popular
                        ? '0 25px 50px -12px rgba(206, 143, 176, 0.2), 0 12px 24px -8px rgba(95, 84, 103, 0.08)'
                        : '0 12px 24px -8px rgba(0,0,0,0.06)',
                    }}
                  >
                    {tariff.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose px-4 py-1 text-sm font-bold text-white">
                        Хит продаж
                      </span>
                    )}
                    {tariff.imageUrl ? (
                      <div className="mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl bg-[var(--lavender-light)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tariff.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <h3 className="font-heading text-xl font-semibold text-[var(--text)]">
                      {tariff.name}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{tariff.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                      {tariff.features.map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                    <p className="mt-6 text-3xl font-bold text-plum">
                      {tariff.price <= 0 ? 'Бесплатно' : `${tariff.price.toLocaleString('ru-RU')} ₽`}
                    </p>
                    <Button
                      variant={tariff.popular ? 'landingRose' : 'landingSoft'}
                      className="mt-6 w-full"
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
