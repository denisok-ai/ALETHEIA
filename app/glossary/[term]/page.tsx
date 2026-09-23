import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { GLOSSARY_TERMS, getGlossarySorted, getGlossaryTerm } from '@/lib/content/glossary';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const revalidate = 3600;

type Props = { params: Promise<{ term: string }> };

const COURSE_LABEL: Record<string, string> = {
  'navyki-myshechnogo-testirovaniya': 'Курс «Тело не врёт» — навыки мышечного тестирования',
  probuzhdenie: 'Курс «Пробуждение» — 21 день практик присутствия',
};

const markdownClassName =
  'mt-6 text-[var(--text)] leading-[var(--leading-body)] [&>p]:mt-0 [&>p]:leading-relaxed [&>p+p]:mt-4 [&_strong]:font-semibold';

export function generateStaticParams() {
  return GLOSSARY_TERMS.map((t) => ({ term: t.slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const t = getGlossaryTerm(params.term);
  if (!t) notFound();
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/glossary/${t.slug}`;
  const title = `${t.term} — что это простыми словами`;
  return {
    // Бренд добавит шаблон layout — иначе двойной суффикс
    title,
    description: t.short,
    alternates: { canonical },
    openGraph: { title, description: t.short, url: canonical, type: 'article', locale: 'ru_RU' },
  };
}

export default async function GlossaryTermPage(props: Props) {
  const params = await props.params;
  const t = getGlossaryTerm(params.term);
  if (!t) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');

  // Ссылки только на реально опубликованные статьи — битых ссылок в глоссарии быть не должно.
  const published = new Map((await getPublishedBlogPosts()).map((p) => [p.slug, p.title]));
  const articles = (t.articles ?? []).filter((s) => published.has(s)).map((s) => ({ slug: s, title: published.get(s)! }));

  // Соседи по алфавиту — сквозная навигация по словарю для робота и человека.
  const sorted = getGlossarySorted();
  const idx = sorted.findIndex((x) => x.slug === t.slug);
  const prev = sorted[idx - 1];
  const next = sorted[idx + 1];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${base}/glossary/${t.slug}`,
    name: t.term,
    ...(t.synonyms?.length ? { alternateName: t.synonyms } : {}),
    description: t.short,
    url: `${base}/glossary/${t.slug}`,
    inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': `${base}/glossary`, name: 'Глоссарий школы Аватэрра' },
  };

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Глоссарий', url: `${base}/glossary` },
          { name: t.term, url: `${base}/glossary/${t.slug}` },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-[var(--text-muted)]">
          <Link href="/" className="hover:underline">Главная</Link>
          <span className="mx-2">/</span>
          <Link href="/glossary" className="hover:underline">Глоссарий</Link>
          <span className="mx-2">/</span>
          <span>{t.term}</span>
        </nav>

        <article className="max-w-[var(--prose-max-width)]">
          <h1 className="font-heading text-3xl font-semibold text-[var(--text)] md:text-4xl">{t.term}</h1>
          {t.synonyms?.length ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Также: {t.synonyms.join(', ')}</p>
          ) : null}
          <p className="mt-5 text-lg leading-relaxed text-[var(--text)]">{t.short}</p>

          <div className={markdownClassName}>
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
              {t.body}
            </ReactMarkdown>
          </div>

          {articles.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-heading text-lg font-semibold text-[var(--text)]">Подробнее в статьях</h2>
              <ul className="mt-3 space-y-2">
                {articles.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/blog/${a.slug}`} className="text-plum underline-offset-2 hover:underline">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {t.course ? (
            <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--text-muted)]">Освоить на практике</p>
              <Link href={`/course/${t.course}`} className="mt-1 block font-heading text-lg font-semibold text-plum hover:underline">
                {COURSE_LABEL[t.course]}
              </Link>
            </section>
          ) : null}

          <p className="mt-8 text-sm italic text-[var(--text-muted)]">
            Это не медицинская рекомендация и не замена врачу или психотерапевту. При острых состояниях обратитесь к специалисту.
          </p>

          <nav className="mt-10 flex justify-between gap-4 border-t border-[var(--border)] pt-6 text-sm" aria-label="Соседние термины">
            {prev ? (
              <Link href={`/glossary/${prev.slug}`} className="text-plum hover:underline">← {prev.term}</Link>
            ) : <span />}
            {next ? (
              <Link href={`/glossary/${next.slug}`} className="text-right text-plum hover:underline">{next.term} →</Link>
            ) : <span />}
          </nav>
        </article>
      </main>
    </>
  );
}
