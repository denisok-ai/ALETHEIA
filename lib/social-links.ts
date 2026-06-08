/** Публичные профили AVATERRA в соцсетях (шапка, подвал, контакты). */
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/avaterrapro/',
  youtube: 'https://www.youtube.com/@AVATERRAPRO',
  telegram: 'https://t.me/+ZTTHAJZfS281OGZi',
} as const;

export type SocialNetwork = keyof typeof SOCIAL_LINKS;
