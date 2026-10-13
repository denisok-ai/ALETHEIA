/**
 * Реквизиты продавца (Исполнителя) — единственный источник правды для сайта.
 *
 * Курсы школы «Аватэрра» продаёт ООО «ЭХОТЕКА»; бренд школы и основательница
 * (Татьяна Стрельцова) остаются в публичном контенте под брендом «Аватэрра».
 * Реквизиты публичные (ЕГРЮЛ), опубликованы и на magicmaster.pro.
 *
 * Email совпадает с контактом поддержки, который уже указан на сайте.
 * Телефон не хардкодится: он задаётся в настройках портала (contact_phone).
 */

export const SELLER_LEGAL_NAME = 'ООО «ЭХОТЕКА»';
export const SELLER_OGRN = '1267700280320';
export const SELLER_INN = '9717194959';
export const SELLER_LEGAL_ADDRESS =
  '129515, г. Москва, вн. тер. г. муниципальный округ Останкинский, ул. 1-я Останкинская, д. 13/1, кв. 73';
export const SELLER_EMAIL = 'support@avaterra.pro';

export const SELLER = {
  legalName: SELLER_LEGAL_NAME,
  ogrn: SELLER_OGRN,
  inn: SELLER_INN,
  address: SELLER_LEGAL_ADDRESS,
  email: SELLER_EMAIL,
} as const;

/** Компактная строка для футера и мест с коротким упоминанием продавца. */
export const SELLER_FOOTER_LINE = `${SELLER_LEGAL_NAME} · ИНН ${SELLER_INN} · ОГРН ${SELLER_OGRN}`;
