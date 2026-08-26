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
import type { BuyIntent } from './buy-intent';

/** Не присылать оффер чаще одного раза в сутки на лид. */
const OFFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function fmtPrice(p: number): string {
  return p <= 0 ? 'бесплатно' : `${p.toLocaleString('ru-RU')} ₽`;
}

/**
 * Собрать сообщение с офером: до двух тарифов, кнопки на страницы оплаты.
 * `intent` влияет только на вступление (цена/рассрочка/сроки — отвечаем на них).
 */
async function buildOffer(
  siteBase: string,
  intent?: BuyIntent | null
): Promise<{ text: string; keyboard: { inline_keyboard: { text: string; url: string }[][] } } | null> {
  const products = (await getCachedPublicProducts()).filter((p) => p.price > 0).slice(0, 2);
  if (!products.length) return null;

  const base = siteBase.replace(/\/$/, '');
  const wantsInstallment = intent?.topics.includes('installment');

  const intro = intent?.topics.includes('timing')
    ? 'Ближайший старт и условия — на странице тарифа. Вот удобные варианты:'
    : intent?.topics.includes('price') || intent?.topics.includes('payment')
      ? 'Вот актуальные тарифы и способ оплаты:'
      : 'Если чувствуете, что откликается, — вот удобный способ начать:';

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
    rows.push([{ text: `Оформить: ${p.name.slice(0, 28)}`, url: `${base}/services/${p.slug}` }]);
  }

  lines.push(
    wantsInstallment
      ? '<i>На странице тарифа можно оформить рассрочку. Это не медицинская услуга — мы работаем со стрессом и телесным откликом.</i>'
      : '<i>Оплата на странице тарифа. Без давления — если остались вопросы, просто напишите, разберём.</i>'
  );

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
    if (!opts.force && lead.offerSentAt && Date.now() - lead.offerSentAt.getTime() < OFFER_COOLDOWN_MS) {
      return { sent: false, reason: 'cooldown' };
    }

    const { siteUrl } = await getBotSiteSettings();
    const offer = await buildOffer(siteUrl || 'https://avaterra.pro', opts.intent);
    if (!offer) return { sent: false, reason: 'no-products' };

    const res = await sendTelegramMessageWithResult(chatId, offer.text, {
      parseMode: 'HTML',
      replyMarkup: offer.keyboard,
      disableWebPagePreview: true,
    });
    if (!res.ok) return { sent: false, reason: 'error' };

    await prisma.lead.update({ where: { id: lead.id }, data: { offerSentAt: new Date() } });
    return { sent: true };
  } catch (e) {
    console.error('[offer] sendOffer:', e);
    return { sent: false, reason: 'error' };
  }
}
