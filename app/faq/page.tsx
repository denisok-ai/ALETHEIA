import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { buildLandingFaqPageJsonLd, FAQ_JSON_LD_ITEMS } from '@/lib/landing-faq';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { SEO_FAQ } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/faq`;
  return {
    ...buildPublicPageMetadata({
      title: SEO_FAQ.title,
      description: SEO_FAQ.description,
      canonical,
    }),
  };
}

export default async function FaqPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/faq`;
  const faqJsonLd = buildLandingFaqPageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Вопросы и ответы', url: pageUrl },
        ]}
      />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Вопросы и ответы' }]} />
        <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
          Вопросы и ответы
        </h1>
        <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
          Собрали ответы о методе, формате обучения и организационных моментах. Полный список совпадает с блоком на{' '}
          <Link href="/#faq" className="text-plum hover:underline">
            главной странице
          </Link>
          .
        </p>

        <div className="mt-10 space-y-3">
          {FAQ_JSON_LD_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] open:bg-[var(--lavender-light)]"
            >
              <summary className="cursor-pointer list-none p-4 font-medium text-[var(--text)] marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <span className="text-[var(--text-muted)] transition-transform group-open:rotate-180">▼</span>
                </span>
              </summary>
              <p className="border-t border-[var(--border)] px-4 pb-4 pt-0 leading-relaxed text-[var(--text-muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-[var(--text-muted)]">
          Не нашли ответ?{' '}
          <Link href="/contacts" className="font-medium text-plum hover:underline">
            Напишите нам
          </Link>{' '}
          или откройте чат внизу страницы.
        </p>
      </main>
    </>
  );
}
