/**
 * Опциональная корзина 54-ФЗ для поля service_name (включается настройками БД).
 */

import { prisma } from '@/lib/db';

export async function buildPaykeeperServiceNamePayload(
  displayTitle: string,
  amountRub: number,
  successRedirectUrl?: string
): Promise<string | Record<string, unknown>> {
  const flag = await prisma.systemSetting.findUnique({
    where: { key: 'paykeeper_fiscal_cart_enabled' },
  });
  const enabled =
    flag?.value === '1' ||
    flag?.value === 'true' ||
    String(flag?.value).toLowerCase() === 'true';
  if (!enabled) {
    return `AVATERRA — ${displayTitle}`;
  }

  const taxRow = await prisma.systemSetting.findUnique({
    where: { key: 'paykeeper_cart_tax' },
  });
  const tax = taxRow?.value?.trim() || 'vat20';
  const lineTitle = `AVATERRA — ${displayTitle}`;
  const cart = JSON.stringify([
    {
      name: lineTitle,
      price: amountRub,
      quantity: 1,
      sum: String(amountRub),
      tax,
    },
  ]);

  const receiptPropsRow = await prisma.systemSetting.findUnique({
    where: { key: 'paykeeper_receipt_properties_json' },
  });
  const receipt_properties = receiptPropsRow?.value?.trim() || undefined;

  const base: Record<string, unknown> = {
    service_name: lineTitle,
    cart,
    lang: 'ru',
  };
  if (successRedirectUrl) base.user_result_callback = successRedirectUrl;
  if (receipt_properties) {
    try {
      JSON.parse(receipt_properties);
      base.receipt_properties = receipt_properties;
    } catch {
      /* ignore invalid JSON */
    }
  }
  return base;
}
