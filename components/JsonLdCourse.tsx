import { absoluteCourseCheckoutUrl, COURSE_SLUG } from '@/lib/content/course-lynda-teaser';
import { LANDING_REVIEWS } from '@/lib/content/testimonials';
import { BRAND_LOGO_URL } from '@/lib/brand';

/**
 * Schema.org: курс, преподаватель и отзывы (главная страница).
 */
export function JsonLdCourse({ siteUrl }: { siteUrl: string }) {
  const base = siteUrl.replace(/\/$/, '');
  const offerUrl = absoluteCourseCheckoutUrl(base);
  const personId = `${base}/about#person`;
  const courseUrl = `${base}/course/${COURSE_SLUG}`;
  const courseDescription =
    'Курс по обучению мышечному тестированию: причина проблемы за 30 секунд, работа с телом и подсознанием, измеримая обратная связь.';

  const reviewsJsonLd = LANDING_REVIEWS.map((r) => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
    author: { '@type': 'Person', name: r.author },
    reviewBody: r.text,
  }));

  const n = LANDING_REVIEWS.length;
  const sum = LANDING_REVIEWS.reduce((acc, r) => acc + r.rating, 0);
  const avg = n > 0 ? (sum / n).toFixed(1) : '5';

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Татьяна Стрельцова',
        jobTitle: 'Основательница школы кинезиологии AVATERRA',
        url: `${base}/about`,
      },
      {
        '@type': 'Course',
        '@id': `${courseUrl}#course`,
        name: 'Курс по мышечному тестированию',
        url: courseUrl,
        description: courseDescription,
        provider: {
          '@type': 'Organization',
          name: 'AVATERRA',
          alternateName: 'АВАТЕРРА',
          url: base,
          logo: `${base}${BRAND_LOGO_URL}`,
        },
        instructor: {
          '@id': personId,
        },
        inLanguage: 'ru-RU',
        offers: {
          '@type': 'Offer',
          url: offerUrl,
          availability: 'https://schema.org/InStock',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: avg,
          bestRating: 5,
          ratingCount: n,
          reviewCount: n,
        },
        review: reviewsJsonLd,
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
