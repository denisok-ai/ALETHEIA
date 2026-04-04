/**
 * Schema.org Article для постов блога.
 */
export function JsonLdBlogArticle({
  headline,
  description,
  pageUrl,
  datePublished,
}: {
  headline: string;
  description: string;
  pageUrl: string;
  datePublished: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url: pageUrl,
    datePublished,
    author: {
      '@type': 'Organization',
      name: 'АВАТЕРРА',
    },
    publisher: {
      '@type': 'Organization',
      name: 'АВАТЕРРА',
    },
    inLanguage: 'ru-RU',
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
