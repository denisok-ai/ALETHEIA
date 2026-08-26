/**
 * Дожим после оффера: одно — и только одно — финальное касание.
 *
 * Кому: получил оффер, но за 2 дня не оплатил, не отписался и не ответил после
 * оффера. Что: мягкое напоминание с реальным отзывом (подобран под запрос лида)
 * и ссылкой на тариф. Без давления и без выдуманных дедлайнов. После дожима,
 * если ещё несколько дней тишины — лид уходит в lost (закрывается воронка).
 *
 * Соц.доказательство — только реальные отзывы из контента курса (MT_TESTIMONIALS),
 * никаких сгенерированных историй.
 */
import { prisma } from '@/lib/db';
import { sendTelegramMessageWithResult } from '@/lib/telegram';
import { getBotSiteSettings } from './settings-cache';
import { MT_TESTIMONIALS } from '@/lib/content/course-mt-landing';

/** Дожимаем не раньше чем через 2 суток после оффера. */
export const NUDGE_AFTER_OFFER_MS = 2 * 24 * 60 * 60 * 1000;
/** После дожима ждём ещё 3 суток, потом lost. */
export const LOST_AFTER_NUDGE_MS = 3 * 24 * 60 * 60 * 1000;

/** Отзыв под аудиторию: у каждого сегмента — свой близкий кейс (по индексу в MT_TESTIMONIALS). */
function testimonialFor(audience: string | null): { text: string; author: string; meta: string } {
  const byAudience: Record<string, number> = {
    tense_body: 0, // Анна — хроническая боль
    personal_crisis: 0,
    specialist: 1, // Мария — психолог
    spiritual: 2,
    skeptic: 2, // Елена — «думала эзотерика, оказалось физиология»
  };
  const idx = (audience ? byAudience[audience] : undefined) ?? 0;
  return MT_TESTIMONIALS[idx] ?? MT_TESTIMONIALS[0];
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Отправить дожим и отметить `offerNudgedAt`. Одноразово, уважает отписку/оплату. */
export async function sendOfferNudge(
  lead: { id: number; telegramChatId: number | null; audience: string | null }
): Promise<boolean> {
  if (!lead.telegramChatId) return false;
  try {
    const { siteUrl } = await getBotSiteSettings();
    const base = (siteUrl || 'https://avaterra.pro').replace(/\/$/, '');
    const t = testimonialFor(lead.audience);

    const text = [
      'Не хочу быть навязчивым — это последнее напоминание.',
      '',
      `<i>${escapeHtml(t.text)}</i>`,
      `— ${escapeHtml(t.author)}, ${escapeHtml(t.meta)}`,
      '',
      'Если чувствуете, что вам это близко, — вот страница курса с программой и оплатой. ' +
        'Нет — ничего страшного, просто оставлю ссылку, вернётесь когда захотите.',
      '',
      '<i>Больше напоминать не буду. Если что — просто напишите сюда.</i>',
    ].join('\n');

    const keyboard = {
      inline_keyboard: [[{ text: '📚 Программа и запись', url: `${base}/course/navyki-myshechnogo-testirovaniya` }]],
    };

    const res = await sendTelegramMessageWithResult(lead.telegramChatId, text, {
      parseMode: 'HTML',
      replyMarkup: keyboard,
      disableWebPagePreview: true,
    });
    if (!res.ok) return false;

    await prisma.lead.update({ where: { id: lead.id }, data: { offerNudgedAt: new Date() } });
    return true;
  } catch (e) {
    console.error('[offer-nudge] send:', e);
    return false;
  }
}
