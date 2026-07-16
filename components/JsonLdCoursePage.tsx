/**
 * Schema.org Course для страницы курса; Offer.url — канонический URL оформления (`COURSE_CHECKOUT_URL`).
 */
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { jsonLdString } from '@/lib/json-ld';
import { BRAND_LOGO_URL } from '@/lib/brand';

export function JsonLdCoursePage({
  name,
  description,
  pageUrl,
  priceRange,
}: {
  name: string;
  description: string;
  pageUrl: string;
  /** Цены в рублях: low === high — одна цена, иначе AggregateOffer с диапазоном */
  priceRange?: { low: number; high: number };
}) {
  let origin = '';
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = '';
  }
  let offerUrl: string;
  try {
    offerUrl = absoluteCourseCheckoutUrl(new URL(pageUrl).origin);
  } catch {
    offerUrl = pageUrl;
  }
  const instructorUrl = origin ? `${origin.replace(/\/$/, '')}/about#person` : undefined;
  const logoUrl = origin ? `${origin.replace(/\/$/, '')}${BRAND_LOGO_URL}` : undefined;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url: pageUrl,
    provider: {
      '@type': 'Organization',
      name: 'AVATERRA',
      alternateName: 'АВАТЕРРА',
      url: origin || undefined,
      ...(logoUrl ? { logo: logoUrl } : {}),
    },
    ...(instructorUrl
      ? {
          instructor: {
            '@type': 'Person',
            '@id': instructorUrl,
            name: 'Татьяна Стрельцова',
            url: origin ? `${origin.replace(/\/$/, '')}/about` : undefined,
          },
        }
      : {}),
    inLanguage: 'ru-RU',
    offers: priceRange
      ? priceRange.low === priceRange.high
        ? {
            '@type': 'Offer',
            url: offerUrl,
            price: priceRange.low,
            priceCurrency: 'RUB',
            availability: 'https://schema.org/InStock',
            category: priceRange.low > 0 ? 'Paid' : 'Free',
          }
        : {
            '@type': 'AggregateOffer',
            url: offerUrl,
            lowPrice: priceRange.low,
            highPrice: priceRange.high,
            priceCurrency: 'RUB',
            availability: 'https://schema.org/InStock',
            category: 'Paid',
          }
      : {
          '@type': 'Offer',
          url: offerUrl,
          availability: 'https://schema.org/InStock',
        },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
