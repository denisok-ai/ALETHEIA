import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { CourseCheckoutCTA } from '@/components/CourseCheckoutCTA';
import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

const DESCRIPTION = 'Статьи о мышечном тестировании, теле и подсознании — школы АВАТЕРРА.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/blog`;
  const title = 'Блог | АВАТЕРРА';

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { title, description: DESCRIPTION, url: canonical, type: 'website', locale: 'ru_RU' },
    robots: { index: true, follow: true },
  };
}

export default async function BlogIndexPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');

  return (
    <>
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
        {blogPostsMeta.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] transition-colors hover:border-plum/30"
            >
              <h2 className="font-heading text-xl font-semibold text-[var(--text)]">{post.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{post.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-plum">Читать</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <CourseCheckoutCTA />
      </div>
    </main>
    </>
  );
}
