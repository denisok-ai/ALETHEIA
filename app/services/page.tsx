/**
 * Публичный каталог тарифов и услуг школы (SSR из БД) — индексируемая витрина.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublicProducts } from '@/lib/shop/public-products';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { jsonLdString } from '@/lib/json-ld';

const TITLE = 'Тарифы и услуги школы АВАТЕРРА';
const DESCRIPTION =
  'Обучение мышечному тестированию: бесплатное знакомство с методом, полный курс «Практик» и наставничество Татьяны Стрельцовой. Актуальные цены и состав тарифов.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  return buildPublicPageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    canonical: `${base}/services`,
  });
}

export default async function ServicesIndexPage() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const products = await getPublicProducts();

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: TITLE,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/services/${p.slug}`,
      name: p.name,
    })),
  };

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Тарифы и услуги', url: `${base}/services` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <div className="bg-[var(--bg)] text-[var(--text)]">
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 md:px-8">
          <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Тарифы и услуги' }]} />
          <h1 className="mt-6 font-heading text-3xl font-semibold sm:text-4xl">{TITLE}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-[var(--text-muted)]">{DESCRIPTION}</p>

          {products.length === 0 ? (
            <p className="mt-12 text-[var(--text-muted)]">
              Витрина обновляется. Напишите нам через{' '}
              <Link href="/contacts" className="text-plum underline underline-offset-4">
                страницу контактов
              </Link>{' '}
              — подскажем актуальные форматы обучения.
            </p>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Link
                  key={p.slug}
                  href={`/services/${p.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-shadow hover:border-plum/35 hover:shadow-xl hover:shadow-black/5"
                >
                  {p.imageUrl ? (
                    <div className="relative aspect-[3/2] w-full shrink-0 bg-[var(--lavender-light)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-7">
                    <h2 className="font-heading text-xl font-semibold group-hover:text-plum">
                      {p.name}
                    </h2>
                    <p className="mt-2 flex-1 text-sm text-[var(--text-muted)]">{p.cardDescription}</p>
                    <p className="mt-5 text-2xl font-bold text-plum">
                      {p.price <= 0 ? 'Бесплатно' : `${p.price.toLocaleString('ru-RU')} ₽`}
                    </p>
                    <span className="mt-3 text-sm text-plum underline-offset-4 group-hover:underline">
                      Подробнее о тарифе →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--lavender-light)] p-7">
            <h2 className="font-heading text-xl font-semibold">О курсе</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-muted)]">
              Все тарифы дают доступ к обучению мышечному тестированию — методу, который помогает
              находить причину проблемы через обратную связь тела. Подробная программа — на{' '}
              <Link
                href="/course/navyki-myshechnogo-testirovaniya"
                className="text-plum underline underline-offset-4"
              >
                странице курса
              </Link>
              , ответы на частые вопросы — в{' '}
              <Link href="/faq" className="text-plum underline underline-offset-4">
                разделе FAQ
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
