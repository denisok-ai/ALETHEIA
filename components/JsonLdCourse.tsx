import { absoluteCourseCheckoutUrl, COURSE_SLUG } from '@/lib/content/course-lynda-teaser';
import { jsonLdString } from '@/lib/json-ld';
import { BRAND_LOGO_URL } from '@/lib/brand';

/** Schema.org: курс и преподаватель. Рейтинг и отзывы не выводим: отзывы в lib/content/testimonials.ts не о практикуме «Тело знает всё», рейтинг по ним — вводящая в заблуждение разметка (риск ручных мер Google). */
export type CourseOfferInput = { name: string; price: number; url: string };

export function JsonLdCourse({
  siteUrl,
  offers,
}: {
  siteUrl: string;
  /** Реальные тарифы из БД (имя, цена в рублях, URL страницы тарифа) */
  offers?: CourseOfferInput[];
}) {
  const base = siteUrl.replace(/\/$/, '');
  const offerUrl = absoluteCourseCheckoutUrl(base);
  const personId = `${base}/about#person`;
  const courseUrl = `${base}/course/${COURSE_SLUG}`;
  const courseDescription =
    'Практикум мышечного тестирования «Тело знает всё» для самостоятельного освоения: как присматриваться к телесному и эмоциональному напряжению через обратную связь мышц, работа с телом и подсознанием, в своём темпе.';

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
        name: 'Тело знает всё — практикум мышечного тестирования',
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
        // Google Course rich results требуют hasCourseInstance с courseMode/courseWorkload
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'Online',
          // ~6 часов: 6 модулей для самостоятельного освоения, без живых занятий
          courseWorkload: 'PT6H',
          inLanguage: 'ru-RU',
        },
        offers:
          offers && offers.length > 0
            ? offers.map((o) => ({
                '@type': 'Offer',
                name: o.name,
                price: o.price,
                priceCurrency: 'RUB',
                url: o.url,
                availability: 'https://schema.org/InStock',
                category: o.price > 0 ? 'Paid' : 'Free',
              }))
            : {
                '@type': 'Offer',
                url: offerUrl,
                availability: 'https://schema.org/InStock',
              },
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
