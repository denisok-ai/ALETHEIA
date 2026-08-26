/**
 * Подписанные ссылки оффера с трекингом клика.
 *
 * Ссылка в оффере ведёт не прямо на /services/<slug>, а через редирект
 * /api/r/offer, который отмечает `offerClickedAt` и уводит на страницу оплаты.
 * Клик — самый горячий сигнал: человек пошёл платить. Кликнул, но не купил —
 * первый кандидат на дожим.
 *
 * Подпись (HMAC от NEXTAUTH_SECRET) не даёт подделать чужой leadId в открытой
 * ссылке — иначе кто угодно мог бы накручивать «клики» произвольным лидам.
 */
import { createHmac } from 'crypto';

function secret(): string {
  return process.env.NEXTAUTH_SECRET || '';
}

/** Короткая подпись пары (leadId, slug). */
export function signOfferLink(leadId: number, slug: string): string {
  return createHmac('sha256', secret()).update(`${leadId}:${slug}`).digest('hex').slice(0, 16);
}

export function verifyOfferLink(leadId: number, slug: string, sig: string): boolean {
  const expected = signOfferLink(leadId, slug);
  // Длины фиксированы (16 hex) — простое сравнение не течёт по времени осмысленно.
  return sig.length === expected.length && sig === expected;
}

/** Абсолютная трекинг-ссылка оффера: /api/r/offer?l=&s=&t= */
export function buildTrackedOfferUrl(base: string, leadId: number, slug: string): string {
  const b = base.replace(/\/$/, '');
  const sig = signOfferLink(leadId, slug);
  return `${b}/api/r/offer?l=${leadId}&s=${encodeURIComponent(slug)}&t=${sig}`;
}
