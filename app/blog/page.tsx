import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdBlogIndex } from '@/components/JsonLdBlogIndex';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';

const DESCRIPTION = 'Статьи о мышечном тестировании, теле и подсознании — школы АВАТЕРРА.';

/** Статей на странице. Список пополняется ежедневно из Telegram-канала. */
const PAGE_SIZE = 9;

type Props = { searchParams?: { page?: string } };

/** Номер страницы из адреса. Мусор и значения вне диапазона сводим к первой. */
function pageFromParams(raw: string | undefined, totalPages: number): number {
  const n = Number.parseInt(raw ?? '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const posts = await getPublishedBlogPosts();
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const page = pageFromParams(searchParams?.page, totalPages);

  // Канонический адрес указывает сам на себя, а не на первую страницу: иначе
  // поисковик считает вторую и последующие копиями первой и выбрасывает их из
  // индекса вместе со ссылками на статьи, которые видны только там.
  const canonical = page > 1 ? `${base}/blog?page=${page}` : `${base}/blog`;
  const title =
    page > 1
      ? `Блог о мышечном тестировании — страница ${page}`
      : 'Блог о мышечном тестировании и работе с телом';

  return {
    ...buildPublicPageMetadata({
      title,
      description: DESCRIPTION,
      canonical,
      ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    }),
  };
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const allPosts = await getPublishedBlogPosts();
  const totalPages = Math.max(1, Math.ceil(allPosts.length / PAGE_SIZE));
  const page = pageFromParams(searchParams?.page, totalPages);
  const posts = allPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <JsonLdBlogIndex
        siteUrl={base}
        posts={posts.map((p) => ({ slug: p.slug, title: p.title }))}
      />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Блог', url: `${base}/blog` },
        ]}
      />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
      <nav className="mb-6 text-sm text-[var(--text-muted)]">
        <Link href="/" className="hover:text-plum">
          Главная
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-[var(--text)]">Блог</span>
      </nav>

      <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">Блог</h1>
      <p className="mt-4 text-[var(--text-muted)]">Материалы для тех, кто хочет глубже слышать тело и работать с причиной, а не только со следствием.</p>

      <ul className="mt-8 space-y-5">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition-colors hover:border-plum/30"
            >
              {/* Обложка есть не у всех статей: у перенесённых из файла её нет,
                  и карточка тогда остаётся текстовой, без пустого места. */}
              {post.coverImage ? (
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  width={800}
                  height={420}
                  sizes="(max-width: 768px) 100vw, 700px"
                  className="h-48 w-full object-cover sm:h-56"
                />
              ) : null}
              <div className="p-6">
              <h2 className="font-heading text-xl font-semibold text-[var(--text)]">{post.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{post.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-plum">Читать</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Обычные ссылки, а не кнопки: по ним должен пройти и поисковик, иначе
          статьи со второй страницы останутся вне обхода. */}
      {totalPages > 1 ? (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Страницы блога">
          {page > 1 ? (
            <Link
              href={page === 2 ? '/blog' : `/blog?page=${page - 1}`}
              rel="prev"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-plum/40 hover:text-plum"
            >
              Назад
            </Link>
          ) : null}

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={n === 1 ? '/blog' : `/blog?page=${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={
                n === page
                  ? 'rounded-lg border border-plum bg-plum/10 px-4 py-2 text-sm font-medium text-plum'
                  : 'rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-plum/40 hover:text-plum'
              }
            >
              {n}
            </Link>
          ))}

          {page < totalPages ? (
            <Link
              href={`/blog?page=${page + 1}`}
              rel="next"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-plum/40 hover:text-plum"
            >
              Вперёд
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="mt-6 text-center text-sm text-[var(--text-soft)]">
        Всего статей: {allPosts.length}
        {totalPages > 1 ? ` · страница ${page} из ${totalPages}` : ''}
      </p>

      <div className="mt-10">
        <CourseCheckoutCTA />
      </div>
    </main>
    </>
  );
}
