import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdPerson } from '@/components/JsonLdPerson';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { ABOUT_MASTER } from '@/lib/content/about-master';
import { getSystemSettings } from '@/lib/settings';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { DEFAULT_OG_IMAGE_PATH, SEO_ABOUT } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/about`;
  return {
    ...buildPublicPageMetadata({
      title: SEO_ABOUT.title,
      description: SEO_ABOUT.description,
      canonical,
      ogImageUrl: `${base}${DEFAULT_OG_IMAGE_PATH}`,
    }),
  };
}

export default async function AboutPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/about`;
  const personId = `${pageUrl}#person`;
  const imageAbs = `${base}${ABOUT_MASTER.imageSrc}`;

  return (
    <>
      <JsonLdPerson
        id={personId}
        name={ABOUT_MASTER.name}
        description={ABOUT_MASTER.paragraphs.join(' ')}
        url={pageUrl}
        imageUrl={imageAbs}
        jobTitle="Основательница школы кинезиологии АВАТЕРРА"
      />
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'О мастере', url: pageUrl },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-20 font-body md:pt-24">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'О мастере' }]} />
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
          <div className="relative mx-auto w-full max-w-sm lg:mx-0">
            <div className="overflow-hidden rounded-2xl border-2 border-periwinkle/50 shadow-[var(--shadow-card)]">
              <Image
                src={ABOUT_MASTER.imageSrc}
                alt={ABOUT_MASTER.imageAlt}
                width={480}
                height={640}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-plum">{ABOUT_MASTER.eyebrow}</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              {ABOUT_MASTER.name}
            </h1>
            <p className="mt-2 text-[var(--text-muted)]">{ABOUT_MASTER.subtitle}</p>
            {ABOUT_MASTER.paragraphs.map((p, i) => (
              <p key={p.slice(0, 32)} className={`text-[var(--text-muted)] leading-relaxed ${i === 0 ? 'mt-7' : 'mt-6'}`}>
                {p}
              </p>
            ))}
            <p className="mt-6 border-l-4 border-rose pl-4 font-heading text-lg italic text-[var(--text)]">
              {ABOUT_MASTER.quote}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/#pricing" className={cn(buttonVariants({ variant: 'landingPlum' }))}>
                Записаться на курс
              </Link>
              <Link
                href="/course/navyki-myshechnogo-testirovaniya"
                className={cn(
                  buttonVariants({ variant: 'landingSoft' }),
                  'border border-plum/30 text-[#5F5467] hover:bg-plum/10'
                )}
              >
                Программа курса
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
