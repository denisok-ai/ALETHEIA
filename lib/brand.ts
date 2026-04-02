/**
 * Публичный брендинг на сайте (русское имя школы + пути к логотипу в /public).
 *
 * Логотип заказчика — возможные расположения (проверяются по очереди в BrandLogo):
 * 1) `public/images/1775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png`
 * 2) `public/images 1775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png` (пробел в имени файла в корне public)
 */
export const BRAND_SITE_NAME = 'Аватера';
export const BRAND_SCHOOL_LINE = `Школа кинезиологии «${BRAND_SITE_NAME}»`;

/**
 * Порядок проверки:
 * 1) `public/images 1775123638097-….png` (пробел в имени, в URL — %20)
 * 2) `public/images/1775123638097-….png` (удобная копия в папке images)
 */
export const BRAND_LOGO_PATHS = [
  '/images%201775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png',
  '/images/1775123638097-019d4d9b-bc7a-7a4f-9526-28745702cc31.png',
] as const;

/** @deprecated используйте BRAND_LOGO_PATHS[0] */
export const BRAND_LOGO_PATH = BRAND_LOGO_PATHS[0];
