import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { JsonLdBlogArticle } from '@/components/JsonLdBlogArticle';
import { blogArticleBodies, blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

const PUBLISHED = '2026-04-01T12:00:00+03:00';

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

  return (
    <>
      <JsonLdBlogArticle
        headline={body.h1}
        description={post.description}
        pageUrl={pageUrl}
        datePublished={PUBLISHED}
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
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Опубликовано: {new Date(PUBLISHED).toLocaleDateString('ru-RU')}
          </p>
          <div className="mt-6 space-y-4 leading-[var(--leading-body)] text-[var(--text)]">
            {body.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>

        <div className="mt-10">
          <CourseCheckoutCTA />
        </div>
      </main>
    </>
  );
}
