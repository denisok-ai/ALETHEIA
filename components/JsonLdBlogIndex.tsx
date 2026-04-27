/**
 * Schema.org: список статей блога (ItemList) для страницы /blog.
 */
type PostRef = { slug: string; title: string };

export function JsonLdBlogIndex({ siteUrl, posts }: { siteUrl: string; posts: PostRef[] }) {
  const base = siteUrl.replace(/\/$/, '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Блог школы АВАТЕРРА',
    numberOfItems: posts.length,
    itemListElement: posts.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'BlogPosting',
        name: p.title,
        url: `${base}/blog/${p.slug}`,
      },
    })),
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
