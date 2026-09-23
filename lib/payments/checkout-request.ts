/**
 * Режим «оплата по заявке»: онлайн-касса выключена (PayKeeper недоступен,
 * новая касса ещё не подключена), но покупатель не должен теряться.
 *
 * Вместо счёта кассы: заказ сохраняется как pending (его потом можно закрыть
 * вручную), в CRM создаётся/обновляется горячий лид «Заявка на оплату», владельцу
 * сразу уходит сообщение в Telegram со ссылкой на карточку. Клиент видит
 * «заявка принята, пришлём способ оплаты».
 *
 * Order.userId здесь НЕ трогаем: он ставится только вместе с зачислением —
 * на этом держится сверка платежей.
 */
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';

export type PaymentsMode = 'online' | 'request';

/** Текущий режим приёма оплаты (Портал → Настройки; fallback — env PAYMENTS_MODE). */
export async function getPaymentsMode(): Promise<PaymentsMode> {
  const s = await getSystemSettings();
  return s.payments_mode === 'request' ? 'request' : 'online';
}

export const CHECKOUT_REQUEST_SOURCE = 'checkout_request';

/** Текст для покупателя — без внутренних терминов. */
export const CHECKOUT_REQUEST_CLIENT_MESSAGE =
  'Заявка принята! Мы свяжемся с вами в ближайшее время и пришлём удобный способ оплаты. ' +
  'Заказ сохранён — ничего повторно заполнять не нужно.';

export type CheckoutRequestInput = {
  orderNumber: string;
  productName: string;
  amount: number;
  email: string;
  name: string;
  phone?: string | null;
  /** Откуда пришла заявка — для карточки лида и уведомления. */
  via: 'сайт (кнопка оплаты)' | 'персональная ссылка оплаты';
};

/**
 * Лид «Заявка на оплату» + уведомление владельцу. Ошибки уведомления не роняют
 * ответ клиенту: заказ уже сохранён, лид — главный след.
 */
export async function recordCheckoutRequest(input: CheckoutRequestInput): Promise<{ leadId: number | null }> {
  const email = input.email.trim();
  const phone = input.phone?.trim() || '';
  const stamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const line = `[${stamp}] Заявка на оплату (${input.via}): ${input.productName} — ${input.amount.toLocaleString('ru-RU')} ₽, заказ ${input.orderNumber}`;

  let leadId: number | null = null;
  try {
    const existing = await prisma.lead.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          // Интент покупки поднимает статус до qualified; оплаченного (converted) не трогаем.
          status: existing.status === 'converted' ? 'converted' : 'qualified',
          qualifiedAt: existing.qualifiedAt ?? new Date(),
          buyIntentAt: new Date(),
          lastOrderNumber: input.orderNumber,
          message: [existing.message, line].filter(Boolean).join('\n').slice(-4000),
          ...(phone && existing.phone.startsWith('tg:') ? { phone } : {}),
        },
      });
      leadId = updated.id;
    } else {
      const created = await prisma.lead.create({
        data: {
          name: input.name.trim() || email,
          phone: phone || email,
          email,
          message: line,
          status: 'qualified',
          source: CHECKOUT_REQUEST_SOURCE,
          qualifiedAt: new Date(),
          qualifyReason: 'хочет оплатить, онлайн-касса выключена',
          buyIntentAt: new Date(),
          lastOrderNumber: input.orderNumber,
        },
      });
      leadId = created.id;
    }
  } catch (e) {
    console.error('[checkout-request] лид:', e);
  }

  try {
    const settings = await getSystemSettings();
    const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
    await notifyAdminsTelegram('checkout_request', [
      '🛒 Клиент хочет оплатить — онлайн-касса выключена, свяжитесь и пришлите способ оплаты',
      `Тариф: ${input.productName} — ${input.amount.toLocaleString('ru-RU')} ₽`,
      `Имя: ${input.name.trim() || '—'}`,
      `Email: ${email}`,
      `Телефон: ${phone || '—'}`,
      `Заказ: ${input.orderNumber} (${input.via})`,
      leadId ? `Карточка: ${base}/portal/admin/crm/leads/${leadId}` : 'Карточку лида создать не удалось — заказ в разделе оплат',
    ]);
  } catch (e) {
    console.error('[checkout-request] уведомление:', e);
  }

  return { leadId };
}
