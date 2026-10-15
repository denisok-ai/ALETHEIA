'use client';

import { useEffect } from 'react';
import { ANALYTICS, trackYmGoal } from '@/lib/analytics-events';

/**
 * Цель «оплата прошла» с суммой заказа (доход в отчётах Метрики).
 * Рендерится только для оплаченного заказа; повторный заход на /success
 * по тому же заказу (обновление, «назад») цель не дублирует.
 */
export function AnalyticsPaymentSuccess({ orderNumber, amountRub }: { orderNumber: string; amountRub: number }) {
  useEffect(() => {
    const key = `ym_paid_${orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      // Хранилище недоступно (приватный режим) — лучше редкий дубль, чем потерянная оплата.
    }
    trackYmGoal(ANALYTICS.PAYMENT_SUCCESS, { order_price: amountRub, currency: 'RUB' });
  }, [orderNumber, amountRub]);
  return null;
}
