/**
 * Schema.org BlogPosting для статей блога (SEO).
 */
import { BRAND_LOGO_URL } from '@/lib/brand';

export function JsonLdBlogArticle({
  headline,
  description,
  pageUrl,
  datePublished,
  dateModified,
  imageUrl,
  authorName = 'Татьяна Стрельцова',
}: {
  headline: string;
  description: string;
  pageUrl: string;
  datePublished: string;
  /** Если не задано — совпадает с datePublished */
  dateModified?: string;
  /** Абсолютный URL изображения для превью */
  imageUrl?: string;
  authorName?: string;
}) {
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return '';
    }
  })();
  const logoUrl = origin ? `${origin}${BRAND_LOGO_URL}` : undefined;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url: pageUrl,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'АВАТЕРРА',
      ...(logoUrl
        ? {
            logo: {
              '@type': 'ImageObject',
              url: logoUrl,
            },
          }
        : {}),
    },
    inLanguage: 'ru-RU',
  };

  if (imageUrl) {
    data.image = [imageUrl];
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
