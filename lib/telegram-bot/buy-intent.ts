/**
 * Детект намерения купить в свободном сообщении лида.
 *
 * Детерминированно, по ключевым словам (как faq-match) — никакой LLM-догадки
 * о намерении: она ненадёжна и может увести менеджера/оффер не туда. Ловим
 * только явные сигналы готовности к покупке: цена, оплата, рассрочка, запись,
 * сроки старта. Возвращаем и «тему» — по ней оффер и квалификация точнее.
 */

export type BuyIntent = {
  /** Что именно спросил — для пометки в CRM и текста оффера. */
  topics: Array<'price' | 'payment' | 'installment' | 'enroll' | 'timing'>;
};

const PATTERNS: Array<{ topic: BuyIntent['topics'][number]; re: RegExp }> = [
  { topic: 'price', re: /(сколько стоит|стоимость|це́?на|почём|почем|прайс|во сколько обойдётся|бюджет)/i },
  { topic: 'payment', re: /(как оплатить|оплата|оплатить|купить|приобрести|заказать|карт(ой|у)|перевод)/i },
  { topic: 'installment', re: /(рассрочк|частям|в кредит|помесячно|платеж(и|ами))/i },
  { topic: 'enroll', re: /(как записаться|записаться|как попасть|как начать|хочу участвовать|хочу пойти|запишите|беру|готов купить)/i },
  { topic: 'timing', re: /(когда старт|когда начало|ближайший поток|когда начина|дата старта|следующий набор)/i },
];

/** Найти сигналы покупки. null — их нет. */
export function detectBuyIntent(text: string): BuyIntent | null {
  const topics = PATTERNS.filter((p) => p.re.test(text)).map((p) => p.topic);
  return topics.length ? { topics: [...new Set(topics)] } : null;
}

const TOPIC_LABEL: Record<BuyIntent['topics'][number], string> = {
  price: 'цена',
  payment: 'оплата',
  installment: 'рассрочка',
  enroll: 'запись',
  timing: 'сроки старта',
};

export function describeBuyIntent(intent: BuyIntent): string {
  return intent.topics.map((t) => TOPIC_LABEL[t]).join(', ');
}
