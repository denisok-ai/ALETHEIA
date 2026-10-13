import { buildStartPayload } from './telegram-bot/deep-link';

/** Публичные профили AVATERRA в соцсетях (шапка, подвал, контакты). */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/avaterrapro/',
  youtube: 'https://www.youtube.com/@AVATERRAPRO',
  telegram: 'https://t.me/+ZTTHAJZfS281OGZi',
} as const;

export type SocialNetwork = keyof typeof SOCIAL_LINKS;

/** Telegram-бот школы: @AvaterraProBot — ответы о методе, помощь с выбором курса,
 *  а студентам — прогресс и сертификат. Продвигается блоком TelegramPromo. */
export const TELEGRAM_BOT_URL = 'https://t.me/AvaterraProBot';
export const TELEGRAM_BOT_USERNAME = '@AvaterraProBot';

/**
 * Ссылка-приглашение в бота с меткой источника: `t.me/AvaterraProBot?start=s-<src>`.
 *
 * Так человек сам начинает диалог (Telegram запрещает боту писать первым), а бот
 * при нажатии «Начать» сразу заводит лид в CRM с этим источником и получает право
 * отвечать и напоминать. `leadId` связывает диалог с заявкой, оставленной на сайте.
 * `ref` — метка соцсети первого касания (tg-01): бот запишет её в Lead.acqRef.
 * Передавать только если метка известна серверу (cookie av_ref).
 */
export function botDeepLink(source: string, options: { leadId?: number; ref?: string | null } = {}): string {
  const payload = buildStartPayload({ source, leadId: options.leadId, ref: options.ref });
  return payload ? `${TELEGRAM_BOT_URL}?start=${payload}` : TELEGRAM_BOT_URL;
}
