/**
 * Общие поля metadata для публичных страниц (OG, Twitter, canonical).
 */
import type { Metadata } from 'next';

export function buildPublicPageMetadata(opts: {
  title: string;
  description: string;
  canonical: string;
  ogType?: 'website' | 'article';
  /** Абсолютный URL OG-изображения (по умолчанию — брендовый баннер 1200×630) */
  ogImageUrl?: string;
}): Metadata {
  const { title, description, canonical, ogType = 'website', ogImageUrl } = opts;
  const images = ogImageUrl
    ? [{ url: ogImageUrl, width: 1200, height: 630, alt: title }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: ogType,
      locale: 'ru_RU',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
    robots: { index: true, follow: true },
  };
}
