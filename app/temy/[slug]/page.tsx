import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { TOPIC_HUBS, findTopicHub, hubPosts } from '@/lib/content/topic-hubs';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/pages';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const revalidate = 3600;
// Только известные хабы: остальные адреса отдают 404 (не 200 с пустой страницей).
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOPIC_HUBS.map((hub) => ({ slug: hub.slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const hub = findTopicHub(slug);
  // Неизвестный адрес: метаданные не отдаём, 404 отдаёт сама страница (как у статей блога).
  if (!hub) return { robots: { index: false, follow: false } };
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  return buildPublicPageMetadata({
    // Бренд добавит шаблон layout — иначе двойной суффикс
    title: hub.title,
    description: hub.description,
    canonical: `${base}/temy/${hub.slug}`,
    ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
  });
}

export default async function TopicHubPage(props: Props) {
  const { slug } = await props.params;
  const hub = findTopicHub(slug);
  if (!hub) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/temy/${hub.slug}`;
  // Только опубликованные статьи; снятые slug из хаба пропускаются (см. hubPosts).
  const posts = hubPosts(hub, await getPublishedBlogPosts());

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: hub.title,
    description: hub.description,
    inLanguage: 'ru-RU',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${base}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Блог', url: `${base}/blog` },
          { name: hub.title, url: pageUrl },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-[var(--text-muted)]">
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
          <span className="text-[var(--text)]">{hub.label}</span>
        </nav>

        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] md:text-4xl">{hub.title}</h1>
        <div className="mt-4 space-y-4 leading-relaxed text-[var(--text-muted)]">
          <ReactMarkdown
            components={{
              a({ href, children }) {
                return href?.startsWith('/') ? (
                  <Link href={href} className="font-medium text-plum underline-offset-2 hover:underline">
                    {children}
                  </Link>
                ) : (
                  <a href={href} className="font-medium text-plum underline-offset-2 hover:underline" rel="noopener">
                    {children}
                  </a>
                );
              },
            }}
          >
            {hub.intro}
          </ReactMarkdown>
        </div>

        {posts.length > 0 ? (
          <section className="mt-12" aria-labelledby="hub-posts">
            <h2 id="hub-posts" className="font-heading text-2xl font-semibold text-[var(--text)]">
              Статьи по теме
            </h2>
            <ul className="mt-6 space-y-5">
              {posts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] transition-colors hover:border-plum/30"
                  >
                    <h3 className="font-heading text-xl font-semibold text-[var(--text)]">{post.title}</h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{post.description}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-plum">Читать</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
