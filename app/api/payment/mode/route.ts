/**
 * Публичный режим приёма оплаты — чтобы форма заранее говорила правду:
 * «Перейти к оплате» (касса работает) или «Оставить заявку» (касса выключена).
 */
import { NextResponse } from 'next/server';
import { getPaymentsMode } from '@/lib/payments/checkout-request';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ mode: await getPaymentsMode() });
}
