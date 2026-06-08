/**
 * Публичный брендинг на сайте (русское имя школы + пути к логотипу в /public).
 *
 * Канонический URL для ссылок и метаданных — {@link BRAND_LOGO_URL} (первый элемент {@link BRAND_LOGO_PATHS}).
 * BrandLogo при onError перебирает список дальше.
 */
export const BRAND_SITE_NAME = 'АВАТЕРРА';
/** Строка над заголовком на главной и в hero. */
export const BRAND_SCHOOL_LINE = 'Школа «AVATERRA»';

/**
 * Порядок для сайта (BrandLogo, фавикон): как до отдельного золотого знака для сертификатов.
 */
export const BRAND_LOGO_PATHS = [
  '/images/LOGO.png',
  '/images/avaterra-logo.png',
  '/images%201775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png',
  '/images/1775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png',
] as const;

/**
 * Для PDF и вложений: сначала те же файлы, что у сайта ({@link BRAND_LOGO_PATHS}); затем отдельный золотой знак.
 */
export const CERTIFICATE_LOGO_PATHS = [...BRAND_LOGO_PATHS, '/images/avaterra-gold-logo.png'] as const;

/** Канонический URL логотипа для ссылок, фавиконов и портала. */
export const BRAND_LOGO_URL = BRAND_LOGO_PATHS[0];

/** @deprecated используйте BRAND_LOGO_URL или BRAND_LOGO_PATHS[0] */
export const BRAND_LOGO_PATH = BRAND_LOGO_PATHS[0];
