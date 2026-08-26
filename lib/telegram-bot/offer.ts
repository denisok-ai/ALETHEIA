/**
 * Авто-оффер: бот показывает тариф и ведёт на оплату — без менеджера.
 *
 * Тарифы берём из живой витрины (те же, что на сайте), ссылка ведёт на
 * страницу тарифа `/services/<slug>`, где человек оформляет оплату через
 * PayKeeper. Бот не создаёт платёжную ссылку сам (для неё нужны email и
 * согласие на обработку ПД — их собирает форма на странице тарифа).
 *
 * Этика школы: без давления и обещаний результата, с мягкой рамкой «если
 * откликается — вот удобный способ начать», и с возможностью отписаться.
 */
import { prisma } from '@/lib/db';
import { getCachedPublicProducts } from '@/lib/ai/live-catalog';
import { sendTelegramMessageWithResult } from '@/lib/telegram';
import { getBotSiteSettings } from './settings-cache';
import { buildTrackedOfferUrl } from './offer-link';
import type { BuyIntent } from './buy-intent';
import type { Audience } from './audience';

/** Не присылать оффер чаще одного раза в сутки на лид. */
const OFFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Жёсткий пол: даже реактивный (force) оффер не чаще раза в час — от спама. */
const OFFER_HARD_FLOOR_MS = 60 * 60 * 1000;

function fmtPrice(p: number): string {
  return p <= 0 ? 'бесплатно' : `${p.toLocaleString('ru-RU')} ₽`;
}

/**
 * Собрать сообщение с офером: до двух тарифов, кнопки на страницы оплаты.
 * `intent` влияет только на вступление (цена/рассрочка/сроки — отвечаем на них).
 */
export type OfferVariant = 'A' | 'B';

/** Устойчивое 50/50 назначение варианта по id лида. */
export function assignVariant(leadId: number): OfferVariant {
  return leadId % 2 === 0 ? 'A' : 'B';
}

async function buildOffer(
  siteBase: string,
  leadId: number,
  variant: OfferVariant,
  intent?: BuyIntent | null,
  audience?: Audience | null
): Promise<{ text: string; keyboard: { inline_keyboard: { text: string; url: string }[][] } } | null> {
  const all = (await getCachedPublicProducts()).filter((p) => p.price > 0);
  if (!all.length) return null;
  // Специалисту/скептику ближе продвинутый (дорогой) тариф — покажем его первым;
  // новичку с телесным/личным запросом — сначала базовый (дешёвый).
  const wantsAdvanced = audience === 'specialist' || audience === 'spiritual';
  const sorted = [...all].sort((a, b) => (wantsAdvanced ? b.price - a.price : a.price - b.price));
  const products = sorted.slice(0, 2);

  const base = siteBase.replace(/\/$/, '');
  const wantsInstallment = intent?.topics.includes('installment');

  const audienceIntro: Record<string, string> = {
    tense_body: 'Чтобы мягко работать с напряжением и усталостью — вот удобные форматы:',
    personal_crisis: 'Чтобы найти опору и разобраться с ситуацией — вот с чего можно начать:',
    specialist: 'Чтобы взять метод в свою практику — вот подходящие форматы:',
    spiritual: 'Для глубокой осознанной работы — вот форматы:',
  };
  const intro =
    (audience && audienceIntro[audience]) ||
    (intent?.topics.includes('timing')
      ? 'Ближайший старт и условия — на странице тарифа. Вот удобные варианты:'
      : intent?.topics.includes('price') || intent?.topics.includes('payment')
        ? 'Вот актуальные тарифы и способ оплаты:'
        : 'Если чувствуете, что откликается, — вот удобный способ начать:');

  const lines: string[] = [intro, ''];
  const rows: { text: string; url: string }[][] = [];

  for (const p of products) {
    const installment =
      p.installmentEnabled && p.maxInstallments >= 2
        ? ` · рассрочка от ${Math.ceil(p.price / p.maxInstallments).toLocaleString('ru-RU')} ₽/мес`
        : '';
    lines.push(`<b>${escapeHtml(p.name)}</b> — ${fmtPrice(p.price)}${installment}`);
    if (p.cardDescription) lines.push(escapeHtml(p.cardDescription.slice(0, 160)));
    lines.push('');
    const cta = variant === 'B' ? 'Начать' : 'Оформить';
    rows.push([{ text: `${cta}: ${p.name.slice(0, 28)}`, url: buildTrackedOfferUrl(base, leadId, p.slug) }]);
  }

  if (wantsInstallment) {
    lines.push('<i>На странице тарифа можно оформить рассрочку. Это не медицинская услуга — мы работаем со стрессом и телесным откликом.</i>');
  } else if (variant === 'B') {
    // Вариант B: акцент на безопасность решения (доступ сразу, возврат 7 дней — реальные условия).
    lines.push('<i>Доступ к материалам — сразу после оплаты. Если не подойдёт, действует возврат в течение 7 дней. Решение без риска.</i>');
  } else {
    lines.push('<i>Оплата на странице тарифа. Без давления — если остались вопросы, просто напишите, разберём.</i>');
  }

  return { text: lines.join('\n'), keyboard: { inline_keyboard: rows } };
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type OfferResult = { sent: boolean; reason?: 'no-products' | 'cooldown' | 'unsubscribed' | 'error' };

/**
 * Отправить оффер лиду и отметить `offerSentAt`. Уважает отписку и кулдаун.
 * `force` — обойти кулдаун (для реактивного оффера на прямой интент покупки).
 */
export async function sendOffer(
  chatId: number,
  opts: { intent?: BuyIntent | null; force?: boolean } = {}
): Promise<OfferResult> {
  try {
    const lead = await prisma.lead.findFirst({
      where: { telegramChatId: chatId },
      orderBy: { createdAt: 'desc' },
    });
    if (!lead) return { sent: false, reason: 'error' };
    if (lead.unsubscribedAt) return { sent: false, reason: 'unsubscribed' };
    if (lead.offerSentAt) {
      const sinceOffer = Date.now() - lead.offerSentAt.getTime();
      // force обходит суточный кулдаун, но не жёсткий часовой пол — иначе серия
      // вопросов про покупку («цена?», «рассрочка?», «старт?») даёт серию офферов.
      const floor = opts.force ? OFFER_HARD_FLOOR_MS : OFFER_COOLDOWN_MS;
      if (sinceOffer < floor) return { sent: false, reason: 'cooldown' };
    }

    const variant = (lead.offerVariant as OfferVariant | null) ?? assignVariant(lead.id);
    const { siteUrl } = await getBotSiteSettings();
    const offer = await buildOffer(
      siteUrl || 'https://avaterra.pro',
      lead.id,
      variant,
      opts.intent,
      lead.audience as import('./audience').Audience | null
    );
    if (!offer) return { sent: false, reason: 'no-products' };

    const res = await sendTelegramMessageWithResult(chatId, offer.text, {
      parseMode: 'HTML',
      replyMarkup: offer.keyboard,
      disableWebPagePreview: true,
    });
    if (!res.ok) return { sent: false, reason: 'error' };

    await prisma.lead.update({ where: { id: lead.id }, data: { offerSentAt: new Date(), offerVariant: variant } });
    return { sent: true };
  } catch (e) {
    console.error('[offer] sendOffer:', e);
    return { sent: false, reason: 'error' };
  }
}
