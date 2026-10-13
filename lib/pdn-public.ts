/**
 * Публичные реквизиты оператора ПДн для страниц и футера.
 * По умолчанию оператор — продавец ООО «ЭХОТЕКА» (lib/legal/seller.ts, решение владельца 13.10.2026).
 * NEXT_PUBLIC_PDN_OPERATOR_* переопределяют значения (см. docs/Personal-Data-RKN-Checklist.md).
 */
import { SELLER_INN, SELLER_LEGAL_ADDRESS, SELLER_LEGAL_NAME, SELLER_OGRN } from '@/lib/legal/seller';

export type PdnOperatorPublic = {
  name: string;
  inn: string | null;
  /** ОГРН юрлица или ОГРНИП предпринимателя — подпись в ogrnLabel. */
  ogrn: string | null;
  ogrnLabel: 'ОГРН' | 'ОГРНИП';
  /** Юридический адрес оператора (по умолчанию — адрес ООО из lib/legal/seller.ts). */
  address: string | null;
  dpoEmail: string;
  /** Одна строка для футера */
  footerLine: string;
};

export function getPdnOperatorPublic(): PdnOperatorPublic {
  const name =
    process.env.NEXT_PUBLIC_PDN_OPERATOR_NAME?.trim() || SELLER_LEGAL_NAME;
  const inn = process.env.NEXT_PUBLIC_PDN_OPERATOR_INN?.trim() || SELLER_INN;
  const envOgrnip = process.env.NEXT_PUBLIC_PDN_OPERATOR_OGRNIP?.trim() || null;
  const ogrn = envOgrnip || SELLER_OGRN;
  const ogrnLabel: 'ОГРН' | 'ОГРНИП' = envOgrnip ? 'ОГРНИП' : 'ОГРН';
  // Адрес оператора ПДн — обязательный реквизит политики; заглушки сюда не ставить.
  const address = process.env.NEXT_PUBLIC_PDN_OPERATOR_ADDRESS?.trim() || SELLER_LEGAL_ADDRESS;
  const dpoEmail =
    process.env.NEXT_PUBLIC_PDN_DPO_EMAIL?.trim() || 'support@avaterra.pro';

  // Реквизиты продавца/оператора подвал уже показывает строкой SELLER_FOOTER_LINE.
  const footerLine = '© АВАТЕРРА.';

  return { name, inn, ogrn, ogrnLabel, address, dpoEmail, footerLine };
}
