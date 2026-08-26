import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { BlogArticleCourseLinks } from '@/components/BlogArticleCourseLinks';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { TelegramPromo } from '@/components/TelegramPromo';
import { JsonLdBlogArticle } from '@/components/JsonLdBlogArticle';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { getBlogPostBySlug, getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { computeRelated } from '@/lib/content/blog-related';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

type Props = { params: { slug: string } };

const blogMarkdownClassName =
  'mt-6 text-[var(--text)] leading-[var(--leading-body)] [&>h2]:mt-10 [&>h2]:font-heading [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:text-[var(--text)] [&>h2]:first:mt-0 [&>h3]:mt-8 [&>h3]:mb-2 [&>h3]:font-heading [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-[var(--text)] [&>p]:mt-0 [&>p]:leading-relaxed [&>p+p]:mt-4 [&>ul]:my-4 [&>ul]:ml-5 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul>li]:text-[var(--text-muted)] [&>hr]:my-10 [&>hr]:border-0 [&>hr]:border-t [&>hr]:border-[var(--border)] [&_strong]:font-semibold [&_strong]:text-[var(--text)]';

export async function generateStaticParams() {
  const posts = await getPublishedBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const post = await getBlogPostBySlug(slug);
  // notFound() в generateMetadata → реальный 404-статус (иначе стриминг успевает отдать 200)
  if (!post) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/blog/${slug}`;
  const ogPath = post.ogImage;
  const ogImageAbs = `${base}${ogPath}`;

  return {
    // Бренд добавит шаблон layout — иначе двойной суффикс
    title: post.title,
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
      images: [{ url: ogImageAbs, width: 1200, height: 630, alt: post.title }],
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
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();
  const body = post.body;

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/blog/${slug}`;
  const ogPath = post.ogImage;
  const imageUrlAbs = `${base}${ogPath}`;
  const publishedLabel = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  /**
   * «Читайте также» — тематическая перелинковка (topical authority, SEO-2026):
   * сперва статьи той же темы, затем добор соседями по ленте для полноты обхода.
   * Логика в lib/content/blog-related.ts (покрыта тестами).
   */
  const all = await getPublishedBlogPosts();
  const related = computeRelated(slug, all, 3);

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
        headline={post.h1}
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
            {post.h1}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Опубликовано: {publishedLabel}</p>
          {/* Иллюстрация статьи. Показываем coverImage, а не ogImage: последняя —
              карточка для соцсетей с текстом поверх, в теле статьи неуместна. */}
          {post.coverImage ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
              <Image
                src={post.coverImage}
                alt={post.h1}
                width={1200}
                height={800}
                sizes="(max-width: 768px) 100vw, 720px"
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          ) : null}
          {body.kind === 'markdown' ? (
            <div className={blogMarkdownClassName}>
              <ReactMarkdown
                components={{
                  a({ href, children }) {
                    if (href?.startsWith('/')) {
                      return (
                        <Link href={href} className="font-medium text-plum underline-offset-2 hover:underline">
                          {children}
                        </Link>
                      );
                    }
                    return (
                      <a
                        href={href}
                        className="font-medium text-plum underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {body.markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="mt-6 space-y-4 leading-[var(--leading-body)] text-[var(--text)]">
              {body.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          <BlogArticleCourseLinks slug={slug} />
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
          {/* Метка со слагом статьи: в CRM видно, какой текст привёл человека. */}
          <TelegramPromo variant="card" source={`blog-${slug}`} />
        </div>

        <div className="mt-10">
          <CourseCheckoutCTA />
        </div>
      </main>
    </>
  );
}
