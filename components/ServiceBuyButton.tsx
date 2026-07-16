'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PaymentModal } from '@/components/PaymentModal';
import type { TariffItem } from '@/components/sections/Pricing';

/** Кнопка «Купить» на странице тарифа: открывает существующую модалку оплаты. */
export function ServiceBuyButton({ tariff }: { tariff: TariffItem }) {
  const [open, setOpen] = useState(false);
  const installmentAvailable =
    tariff.installmentEnabled && tariff.price >= 100 && (tariff.maxInstallments ?? 0) >= 2;
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="landingRose" className="px-10" onClick={() => setOpen(true)}>
          {tariff.price <= 0 ? 'Получить бесплатно' : 'Купить'}
        </Button>
        {installmentAvailable && (
          <Button variant="ghost" className="text-plum" onClick={() => setOpen(true)}>
            В рассрочку от{' '}
            {Math.ceil(tariff.price / (tariff.maxInstallments ?? 3)).toLocaleString('ru-RU')} ₽/мес
          </Button>
        )}
      </div>
      <PaymentModal isOpen={open} onClose={() => setOpen(false)} tariff={tariff} />
    </>
  );
}
