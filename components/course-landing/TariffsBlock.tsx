'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/TiltCard';
import { PaymentModal } from '@/components/PaymentModal';
import type { TariffItem } from '@/components/sections/Pricing';

export type LandingTariff = {
  slug: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  badge?: string;
  popular?: boolean;
  imageUrl?: string | null;
};

/** Универсальные карточки тарифов с открытием модального окна оплаты (как в /#pricing). */
export function TariffsBlock({ tariffs }: { tariffs: LandingTariff[] }) {
  const [modalTariff, setModalTariff] = useState<TariffItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:gap-9">
        {tariffs.map((tariff, i) => (
          <motion.div
            key={tariff.slug}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: 0.05 + i * 0.07, duration: 0.45 }}
            className="h-full"
          >
            <TiltCard maxTilt={6} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-2xl border transition-shadow ${
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
                  <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-rose px-4 py-1 text-sm font-bold text-white">
                    Популярный выбор
                  </span>
                )}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
                  {tariff.imageUrl ? (
                    <div className="relative aspect-[3/2] w-full shrink-0 bg-[var(--lavender-light)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tariff.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    </div>
                  ) : null}
                  <div
                    className={
                      tariff.imageUrl
                        ? 'flex flex-1 flex-col p-7 pt-6 md:p-8 md:pt-7'
                        : 'flex flex-1 flex-col p-7 md:p-8'
                    }
                  >
                  {tariff.badge ? (
                    <span className="inline-flex rounded-full bg-periwinkle/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-plum">
                      {tariff.badge}
                    </span>
                  ) : null}
                  <h3 className={`font-heading text-xl font-semibold text-[var(--text)]${tariff.badge ? ' mt-3' : ''}`}>
                    {tariff.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{tariff.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                    {tariff.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plum/60" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-3xl font-bold text-plum">
                    {tariff.price <= 0 ? 'Бесплатно' : `${tariff.price.toLocaleString('ru-RU')} ₽`}
                  </p>
                  <Button
                    variant={tariff.popular ? 'landingRose' : 'landingPlum'}
                    className="mt-6 w-full"
                    onClick={() =>
                      setModalTariff({
                        id: tariff.slug,
                        slug: tariff.slug,
                        name: tariff.name,
                        price: tariff.price,
                        description: tariff.description,
                        features: tariff.features,
                        popular: tariff.popular,
                        imageUrl: tariff.imageUrl ?? null,
                      })
                    }
                  >
                    {tariff.price <= 0 ? 'Получить бесплатно' : 'Оплатить'}
                  </Button>
                  </div>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <PaymentModal
        isOpen={!!modalTariff}
        onClose={() => setModalTariff(null)}
        tariff={modalTariff ?? undefined}
      />
    </>
  );
}
