/**
 * Schema.org Product + Offer для страницы тарифа/услуги (/services/[slug]).
 */
import { jsonLdString } from '@/lib/json-ld';

export function JsonLdProduct({
  name,
  description,
  pageUrl,
  price,
  imageUrl,
  siteUrl,
}: {
  name: string;
  description: string;
  pageUrl: string;
  /** Цена в рублях; 0 — бесплатный продукт */
  price: number;
  imageUrl?: string | null;
  siteUrl: string;
}) {
  const base = siteUrl.replace(/\/$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: pageUrl,
    ...(imageUrl
      ? { image: imageUrl.startsWith('http') ? imageUrl : `${base}${imageUrl}` }
      : {}),
    brand: { '@type': 'Brand', name: 'АВАТЕРРА' },
    offers: {
      '@type': 'Offer',
      url: pageUrl,
      price,
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'AVATERRA',
        alternateName: 'АВАТЕРРА',
        url: base,
      },
      // Цифровой продукт (доступ к курсу в ЛК) — физической доставки нет,
      // стоимость доставки нулевая. Закрывает рекомендацию GSC «shippingDetails».
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: 'RUB',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'RU',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          // Цифровой доступ открывается сразу после оплаты.
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
        },
      },
    },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
