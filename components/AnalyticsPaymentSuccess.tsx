'use client';

import { useEffect } from 'react';
import { ANALYTICS, claimOnce, trackGa4Purchase, trackYmGoal } from '@/lib/analytics-events';

/**
 * Цель «оплата прошла» с суммой заказа (доход в отчётах Метрики) и покупка в GA4.
 * Рендерится только для оплаченного заказа; повторный заход на /success
 * по тому же заказу (обновление, «назад») ни цель, ни покупку не дублирует.
 * Отметки у Метрики и GA4 разные: одна не блокирует другую.
 */
export function AnalyticsPaymentSuccess({
  orderNumber,
  amountRub,
  itemId,
  itemName,
}: {
  orderNumber: string;
  amountRub: number;
  /** Order.tariffId: идентификатор товара для GA4 items. */
  itemId: string;
  /** Название товара, если удалось найти в каталоге (иначе в GA4 уйдёт itemId). */
  itemName: string | null;
}) {
  useEffect(() => {
    if (claimOnce(`ym_paid_${orderNumber}`)) {
      trackYmGoal(ANALYTICS.PAYMENT_SUCCESS, { order_price: amountRub, currency: 'RUB' });
    }
    trackGa4Purchase({ transactionId: orderNumber, valueRub: amountRub, itemId, itemName });
  }, [orderNumber, amountRub, itemId, itemName]);
  return null;
}
