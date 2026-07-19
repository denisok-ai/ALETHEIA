/**
 * Разметка Schema.org для поисковиков (организация / образовательная школа).
 */
import { BRAND_LOGO_URL } from '@/lib/brand';
import { jsonLdString } from '@/lib/json-ld';
import { SOCIAL_LINKS } from '@/lib/social-links';

export type OrgOffer = { name: string; price: number; slug: string };

export function JsonLdOrganization({
  siteUrl,
  phone,
  offers,
}: {
  siteUrl: string;
  phone?: string | null;
  /** Продуктовая линейка из витрины — для hasOfferCatalog */
  offers?: OrgOffer[];
}) {
  const url = siteUrl.replace(/\/$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${url}/#organization`,
    name: 'Школа «AVATERRA»',
    alternateName: ['АВАТЕРРА', 'AVATERRA', 'avaterra.pro'],
    url,
    logo: `${url}${BRAND_LOGO_URL}`,
    description:
      'Школа мышечного тестирования. Курс по обучению методу: причина проблемы за 30 секунд. Основатель — Татьяна Стрельцова.',
    areaServed: 'RU',
    inLanguage: 'ru-RU',
    // Гео-сигнал уровня города (регион продвижения — Москва); улицу не указываем,
    // пока в настройках нет подтверждённого адреса (сейчас там заглушка)
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Москва',
      addressCountry: 'RU',
    },
    // Соцпрофили: связывают сайт с сущностью бренда в графе знаний
    sameAs: Object.values(SOCIAL_LINKS),
    founder: {
      '@type': 'Person',
      name: 'Татьяна Стрельцова',
      url: `${url}/about`,
    },
    // Продуктовая линейка с ценами: поисковики и ИИ-ассистенты видят,
    // что именно продаёт школа, без обхода отдельных страниц
    ...(offers && offers.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Обучение мышечному тестированию',
            itemListElement: offers.map((o) => ({
              '@type': 'Offer',
              name: o.name,
              price: o.price,
              priceCurrency: 'RUB',
              url: `${url}/services/${o.slug}`,
              availability: 'https://schema.org/InStock',
              category: o.price > 0 ? 'Paid' : 'Free',
            })),
          },
        }
      : {}),
    ...(phone?.trim()
      ? {
          telephone: phone.trim(),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
