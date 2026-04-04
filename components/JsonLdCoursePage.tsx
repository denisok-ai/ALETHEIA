/**
 * Schema.org Course для страницы лендинга конкретного курса (Lynda / внешняя оплата).
 */
export function JsonLdCoursePage({
  name,
  description,
  pageUrl,
}: {
  name: string;
  description: string;
  pageUrl: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    description,
    url: pageUrl,
    provider: {
      '@type': 'Organization',
      name: 'АВАТЕРРА',
    },
    inLanguage: 'ru-RU',
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
