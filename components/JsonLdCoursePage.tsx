/**
 * Schema.org Course для страницы курса; Offer.url — канонический URL оформления (`COURSE_CHECKOUT_URL`).
 */
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';
import { BRAND_LOGO_URL } from '@/lib/brand';

export function JsonLdCoursePage({
  name,
  description,
  pageUrl,
}: {
  name: string;
  description: string;
  pageUrl: string;
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
    offers: {
      '@type': 'Offer',
      url: offerUrl,
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
