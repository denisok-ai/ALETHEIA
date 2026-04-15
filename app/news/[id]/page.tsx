/**
 * Public publication page: full text, view count, rating, comments.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdNewsArticle } from '@/components/JsonLdNewsArticle';
import { BLOG_DEFAULT_OG_IMAGE } from '@/lib/content/course-lynda-teaser';
import { prisma } from '@/lib/db';
import { publicationMetaDescription } from '@/lib/publication-seo';
import { sanitizePublicationContent } from '@/lib/sanitize';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { PublicationViewClient } from './PublicationViewClient';

async function getPublicationForRequest(id: string) {
  const now = new Date();
  return prisma.publication.findFirst({
    where: {
      id,
      status: 'active',
      publishAt: { lte: now },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pub = await getPublicationForRequest(id);
  if (!pub) {
    return {};
  }

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/news/${id}`;
  const description = publicationMetaDescription(pub.teaser, pub.content ?? '');
  const ogPath = BLOG_DEFAULT_OG_IMAGE;
  const ogImageAbs = `${base}${ogPath}`;
  const title = `${pub.title} | АВАТЕРРА`;
  const kw = pub.keywords
    ?.split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title,
    description,
    ...(kw?.length ? { keywords: kw } : {}),
    alternates: { canonical },
    openGraph: {
      title: pub.title,
      description,
      url: canonical,
      type: 'article',
      locale: 'ru_RU',
      publishedTime: pub.publishAt.toISOString(),
      modifiedTime: pub.updatedAt.toISOString(),
      images: [{ url: ogImageAbs, width: 1024, height: 1280, alt: pub.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pub.title,
      description,
      images: [ogImageAbs],
    },
    robots: { index: true, follow: true },
  };
}

export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pub = await getPublicationForRequest(id);

  if (!pub) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/news/${id}`;
  const ogPath = BLOG_DEFAULT_OG_IMAGE;
  const imageUrlAbs = `${base}${ogPath}`;
  const description = publicationMetaDescription(pub.teaser, pub.content ?? '');

  return (
    <div className="min-h-screen bg-[var(--bg)] font-body">
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: pub.title, url: pageUrl },
        ]}
      />
      <JsonLdNewsArticle
        headline={pub.title}
        description={description}
        pageUrl={pageUrl}
        datePublished={pub.publishAt.toISOString()}
        dateModified={pub.updatedAt.toISOString()}
        imageUrl={imageUrlAbs}
        useNewsArticle={pub.type === 'news'}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="text-sm text-[var(--portal-accent)] hover:underline mb-6 inline-block"
        >
          ← На главную
        </Link>
        <article className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h1 className="font-heading text-2xl font-bold text-[var(--portal-text)]">{pub.title}</h1>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
            {new Date(pub.publishAt).toLocaleDateString('ru', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div
            className="mt-4 prose prose-sm max-w-none text-[var(--portal-text)]"
            dangerouslySetInnerHTML={{ __html: sanitizePublicationContent(pub.content ?? '') }}
          />
          <PublicationViewClient
            publicationId={pub.id}
            initialViewsCount={pub.viewsCount}
            allowRating={pub.allowRating}
            ratingSum={pub.ratingSum}
            ratingCount={pub.ratingCount}
            allowComments={pub.allowComments}
          />
        </article>
      </div>
    </div>
  );
}
