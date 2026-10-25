/**
 * SEO-переопределения страниц тарифов /services/<slug>: title, description и H1.
 *
 * Зачем (25.10.2026, решение владельца): главная посадочная практикума для поиска —
 * /course/navyki-myshechnogo-testirovaniya (программа, ~1000 слов). Витрина
 * /services/telo-znaet-vse с почти таким же заголовком («Тело знает всё — практикум»)
 * конкурировала с ней, и Google держал в индексе витрину, а курс — нет. Витрина теперь
 * отвечает на другой вопрос — оплата и условия доступа — и ведёт на программу.
 *
 * Название товара (Service.name) не меняется: оно в оплате, письмах, админке и разметке
 * Product. Цену и срок доступа в описание не пишем — они в БД и меняются в админке.
 */
export type ServiceSeoOverride = {
  title: string;
  description: string;
  h1: string;
  /** Заметная ссылка на программу курса под заголовком. */
  programLink?: { href: string; label: string };
};

export const SERVICE_SEO_OVERRIDES: Readonly<Record<string, ServiceSeoOverride>> = {
  'telo-znaet-vse': {
    title: 'Оплата практикума «Тело знает всё» — условия доступа',
    description:
      'Оплата и условия доступа к практикуму «Тело знает всё»: доступ открывается сразу после оплаты, возврат — по условиям оферты. Программа — на странице курса.',
    h1: 'Практикум «Тело знает всё»: оплата и условия доступа',
    programLink: { href: '/course/navyki-myshechnogo-testirovaniya', label: 'Программа практикума' },
  },
};

export function serviceSeoOverride(slug: string): ServiceSeoOverride | undefined {
  return SERVICE_SEO_OVERRIDES[slug];
}
