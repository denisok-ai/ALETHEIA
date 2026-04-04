import { absoluteCourseCheckoutUrl, COURSE_SLUG } from '@/lib/content/course-lynda-teaser';

/**
 * Schema.org: курс и преподаватель (главная страница).
 */
export function JsonLdCourse({ siteUrl }: { siteUrl: string }) {
  const base = siteUrl.replace(/\/$/, '');
  const offerUrl = absoluteCourseCheckoutUrl(base);
  const personId = `${base}/#tatiana-streltsova`;
  const courseUrl = `${base}/course/${COURSE_SLUG}`;
  const courseDescription =
    'Практический курс по прикладному мышечному тестированию и кинезиологии: работа с телом, подсознанием и измеримой обратной связью.';

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Татьяна Стрельцова',
        jobTitle: 'Основательница школы кинезиологии AVATERRA',
        url: base,
      },
      {
        '@type': 'Course',
        '@id': `${courseUrl}#course`,
        name: 'Обучение прикладному мышечному тестированию',
        url: courseUrl,
        description: courseDescription,
        provider: {
          '@type': 'Organization',
          name: 'AVATERRA',
          alternateName: 'АВАТЕРРА',
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
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
