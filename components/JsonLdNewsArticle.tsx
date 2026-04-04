/**
 * Schema.org Article / NewsArticle для публичных публикаций (SEO).
 */
import { BRAND_LOGO_URL } from '@/lib/brand';

type Props = {
  headline: string;
  description: string;
  pageUrl: string;
  datePublished: string;
  dateModified: string;
  /** Абсолютный URL превью; по умолчанию — общий OG-кадр сайта */
  imageUrl?: string;
  /** schema.org: NewsArticle для type news, иначе Article */
  useNewsArticle?: boolean;
};

export function JsonLdNewsArticle({
  headline,
  description,
  pageUrl,
  datePublished,
  dateModified,
  imageUrl,
  useNewsArticle = false,
}: Props) {
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return '';
    }
  })();
  const logoUrl = origin ? `${origin}${BRAND_LOGO_URL}` : undefined;
  const type = useNewsArticle ? 'NewsArticle' : 'Article';

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    headline,
    description,
    url: pageUrl,
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: 'Татьяна Стрельцова',
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
