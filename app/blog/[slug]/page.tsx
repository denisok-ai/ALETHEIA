import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { JsonLdBlogArticle } from '@/components/JsonLdBlogArticle';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import {
  BLOG_DEFAULT_OG_IMAGE,
  blogArticleBodies,
  blogPostsMeta,
} from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return blogPostsMeta.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const post = blogPostsMeta.find((p) => p.slug === slug);
  if (!post) return {};

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/blog/${slug}`;
  const ogPath = post.ogImage ?? BLOG_DEFAULT_OG_IMAGE;
  const ogImageAbs = `${base}${ogPath}`;

  return {
    title: `${post.title} | АВАТЕРРА`,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      locale: 'ru_RU',
      publishedTime: post.publishedAt,
      modifiedTime: post.publishedAt,
      images: [{ url: ogImageAbs, width: 1024, height: 1280, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImageAbs],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = params;
  const post = blogPostsMeta.find((p) => p.slug === slug);
  const body = blogArticleBodies[slug as keyof typeof blogArticleBodies];
  if (!post || !body) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/blog/${slug}`;
  const ogPath = post.ogImage ?? BLOG_DEFAULT_OG_IMAGE;
  const imageUrlAbs = `${base}${ogPath}`;
  const publishedLabel = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const related = blogPostsMeta.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Блог', url: `${base}/blog` },
          { name: post.title, url: pageUrl },
        ]}
      />
      <JsonLdBlogArticle
        headline={body.h1}
        description={post.description}
        pageUrl={pageUrl}
        datePublished={post.publishedAt}
        imageUrl={imageUrlAbs}
      />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <nav className="mb-6 text-sm text-[var(--text-muted)]">
          <Link href="/" className="hover:text-plum">
            Главная
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <Link href="/blog" className="hover:text-plum">
            Блог
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span className="text-[var(--text)] line-clamp-1">Статья</span>
        </nav>

        <article className="max-w-[var(--prose-max-width)]">
          <h1 className="font-heading text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">
            {body.h1}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Опубликовано: {publishedLabel}</p>
          <div className="mt-6 space-y-4 leading-[var(--leading-body)] text-[var(--text)]">
            {body.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>

        {related.length > 0 ? (
          <aside className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Читайте также</h2>
            <ul className="mt-4 space-y-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="text-plum hover:underline">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <div className="mt-10">
          <CourseCheckoutCTA />
        </div>
      </main>
    </>
  );
}
