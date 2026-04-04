/**
 * Schema.org: курс и преподаватель (главная страница).
 */
export function JsonLdCourse({ siteUrl }: { siteUrl: string }) {
  const base = siteUrl.replace(/\/$/, '');
  const personId = `${base}/#tatiana-streltsova`;

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Татьяна Стрельцова',
        url: base,
      },
      {
        '@type': 'Course',
        name: 'Обучение прикладному мышечному тестированию',
        provider: {
          '@type': 'Organization',
          name: 'АВАТЕРРА',
        },
        instructor: {
          '@id': personId,
        },
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
