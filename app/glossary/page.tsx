import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { GLOSSARY_INTRO, getGlossarySorted } from '@/lib/content/glossary';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/glossary`;
  const description =
    'Глоссарий кинезиологии и мышечного тестирования: короткие честные определения терминов — от сверки баланса и лобного обхвата до эмоционального заряда.';
  return {
    // Бренд добавит шаблон layout — иначе двойной суффикс
    title: 'Глоссарий кинезиологии и мышечного тестирования',
    description,
    alternates: { canonical },
    openGraph: { title: 'Глоссарий кинезиологии', description, url: canonical, type: 'website', locale: 'ru_RU' },
  };
}

export default async function GlossaryIndexPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const terms = getGlossarySorted();

  // DefinedTermSet — одна сущность на весь словарь, термины — отдельными страницами.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${base}/glossary`,
    name: 'Глоссарий кинезиологии и мышечного тестирования — школа Аватэрра',
    description: GLOSSARY_INTRO,
    inLanguage: 'ru-RU',
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${base}/glossary/${t.slug}`,
      name: t.term,
      url: `${base}/glossary/${t.slug}`,
    })),
  };

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Глоссарий', url: `${base}/glossary` },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-[var(--text-muted)]">
          <Link href="/" className="hover:underline">Главная</Link>
          <span className="mx-2">/</span>
          <span>Глоссарий</span>
        </nav>
        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] md:text-4xl">
          Глоссарий кинезиологии и мышечного тестирования
        </h1>
        <p className="mt-4 text-[var(--text-muted)] leading-relaxed">{GLOSSARY_INTRO}</p>

        <dl className="mt-10 divide-y divide-[var(--border)]">
          {terms.map((t) => (
            <div key={t.slug} className="py-5">
              <dt>
                <Link
                  href={`/glossary/${t.slug}`}
                  className="font-heading text-xl font-semibold text-plum underline-offset-2 hover:underline"
                >
                  {t.term}
                </Link>
              </dt>
              <dd className="mt-1 text-[var(--text-muted)] leading-relaxed">{t.short}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-12 text-sm text-[var(--text-muted)]">
          Не нашли термин? Спросите в{' '}
          <Link href="/faq" className="text-plum underline-offset-2 hover:underline">
            вопросах и ответах
          </Link>{' '}
          или почитайте{' '}
          <Link href="/blog" className="text-plum underline-offset-2 hover:underline">
            статьи блога
          </Link>
          .
        </p>
      </main>
    </>
  );
}
