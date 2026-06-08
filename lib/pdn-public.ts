/**
 * Публичные реквизиты оператора ПДн для страниц и футера.
 * Задаются в .env через NEXT_PUBLIC_* — см. .env.example и docs/Personal-Data-RKN-Checklist.md.
 */
export type PdnOperatorPublic = {
  name: string;
  inn: string | null;
  ogrnip: string | null;
  address: string;
  dpoEmail: string;
  /** Одна строка для футера */
  footerLine: string;
};

export function getPdnOperatorPublic(): PdnOperatorPublic {
  const name =
    process.env.NEXT_PUBLIC_PDN_OPERATOR_NAME?.trim() ||
    'Индивидуальный предприниматель Стрельцова Татьяна';
  const inn = process.env.NEXT_PUBLIC_PDN_OPERATOR_INN?.trim() || null;
  const ogrnip = process.env.NEXT_PUBLIC_PDN_OPERATOR_OGRNIP?.trim() || null;
  const address =
    process.env.NEXT_PUBLIC_PDN_OPERATOR_ADDRESS?.trim() ||
    '125167, г. Москва, ул. Здоровья, д. 10';
  const dpoEmail =
    process.env.NEXT_PUBLIC_PDN_DPO_EMAIL?.trim() || 'support@avaterra.pro';

  const parts: string[] = [name];
  if (inn) parts.push(`ИНН ${inn}`);
  if (ogrnip) parts.push(`ОГРНИП ${ogrnip}`);

  const footerLine =
    inn && ogrnip
      ? `© АВАТЕРРА. ${parts.join(', ')}.`
      : `© АВАТЕРРА. ${name}. Реквизиты: укажите NEXT_PUBLIC_PDN_OPERATOR_INN и NEXT_PUBLIC_PDN_OPERATOR_OGRNIP в .env (чеклист: docs/Personal-Data-RKN-Checklist.md).`;

  return { name, inn, ogrnip, address, dpoEmail, footerLine };
}
