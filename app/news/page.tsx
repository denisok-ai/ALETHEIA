/**
 * Публичный индекс новостей и анонсов (SSR из БД) — краулируемый хаб для /news/[id]:
 * до этого статьи были «сиротами» без индексной страницы (только виджет на главной).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo/pages';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { jsonLdString } from '@/lib/json-ld';

const TITLE = 'Новости и анонсы школы АВАТЕРРА';
/** Мета-заголовок без бренда: его добавляет шаблон layout */
const SEO_TITLE = 'Новости и анонсы школы';
const DESCRIPTION =
  'События, статьи и объявления школы мышечного тестирования АВАТЕРРА: запуски потоков, живые встречи, новые материалы.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  return buildPublicPageMetadata({
    title: SEO_TITLE,
    description: DESCRIPTION,
    canonical: `${base}/news`,
    ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
  });
}

async function getActivePublications() {
  try {
    return await prisma.publication.findMany({
      where: { status: 'active' },
      select: { id: true, title: true, teaser: true, type: true, publishAt: true },
      orderBy: { publishAt: 'desc' },
      take: 100,
    });
  } catch {
    return [];
  }
}

export default async function NewsIndexPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pubs = await getActivePublications();

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITLE,
    numberOfItems: pubs.length,
    itemListElement: pubs.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/news/${p.id}`,
      name: p.title,
    })),
  };

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Новости', url: `${base}/news` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <div className="bg-[var(--bg)] text-[var(--text)]">
        <div className="mx-auto max-w-4xl px-5 pb-24 pt-20 md:px-8">
          <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Новости' }]} />
          <h1 className="mt-6 font-heading text-3xl font-semibold sm:text-4xl">{TITLE}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-[var(--text-muted)]">{DESCRIPTION}</p>

          {pubs.length === 0 ? (
            <p className="mt-12 text-[var(--text-muted)]">
              Пока нет опубликованных новостей. Загляните в{' '}
              <Link href="/blog" className="text-plum underline underline-offset-4">
                блог
              </Link>{' '}
              — там статьи о методе.
            </p>
          ) : (
            <ul className="mt-10 space-y-5">
              {pubs.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/news/${p.id}`}
                    className="group block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-shadow hover:border-plum/35 hover:shadow-lg hover:shadow-black/5"
                  >
                    <p className="text-xs uppercase tracking-wider text-plum">
                      {p.type === 'announcement' ? 'Анонс' : 'Новость'}
                      {p.publishAt ? (
                        <>
                          {' · '}
                          <time dateTime={new Date(p.publishAt).toISOString()}>
                            {new Date(p.publishAt).toLocaleDateString('ru', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </time>
                        </>
                      ) : null}
                    </p>
                    <h2 className="mt-2 font-heading text-xl font-semibold group-hover:text-plum">
                      {p.title}
                    </h2>
                    {p.teaser ? (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{p.teaser}</p>
                    ) : null}
                    <span className="mt-3 inline-block text-sm text-plum underline-offset-4 group-hover:underline">
                      Читать →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
