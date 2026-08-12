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
