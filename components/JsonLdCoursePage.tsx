/**
 * Schema.org Course для страницы курса; Offer.url — канонический URL оформления (`COURSE_CHECKOUT_URL`).
 */
import { absoluteCourseCheckoutUrl } from '@/lib/content/course-lynda-teaser';

export function JsonLdCoursePage({
  name,
  description,
  pageUrl,
}: {
  name: string;
  description: string;
  pageUrl: string;
}) {
  let offerUrl: string;
  try {
    offerUrl = absoluteCourseCheckoutUrl(new URL(pageUrl).origin);
  } catch {
    offerUrl = pageUrl;
  }
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
    },
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
