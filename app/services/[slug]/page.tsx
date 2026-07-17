/**
 * Публичная страница тарифа/услуги (SSR из БД): описание, состав, цена, покупка.
 * Product + Offer в schema.org — цены видны поисковикам и ИИ-ассистентам.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublicProductBySlug, getPublicProducts } from '@/lib/shop/public-products';
import { buildPublicPageMetadata } from '@/lib/seo/metadata-helpers';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLdBreadcrumbList } from '@/components/JsonLdBreadcrumbList';
import { JsonLdProduct } from '@/components/JsonLdProduct';
import { ServiceBuyButton } from '@/components/ServiceBuyButton';
import type { TariffItem } from '@/components/sections/Pricing';

type Params = { slug: string };

function metaDescriptionFor(name: string, card: string, price: number): string {
  const priceText = price <= 0 ? 'Бесплатно' : `Цена ${price.toLocaleString('ru-RU')} ₽`;
  const text = `${card} ${priceText}. Онлайн-школа мышечного тестирования АВАТЕРРА.`;
  return text.length > 300 ? `${text.slice(0, 297)}…` : text;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getPublicProductBySlug(params.slug);
  // notFound() в generateMetadata → реальный 404-статус (иначе стриминг успевает отдать 200)
  if (!product) notFound();
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const ogImageUrl = product.imageUrl
    ? product.imageUrl.startsWith('http')
      ? product.imageUrl
      : `${base}${product.imageUrl}`
    : undefined;
  return buildPublicPageMetadata({
    title: product.name,
    description: metaDescriptionFor(product.name, product.cardDescription, product.price),
    canonical: `${base}/services/${product.slug}`,
    ogImageUrl,
  });
}

export default async function ServicePage({ params }: { params: Params }) {
  const product = await getPublicProductBySlug(params.slug);
  if (!product) notFound();

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const pageUrl = `${base}/services/${product.slug}`;

  const tariff: TariffItem = {
    id: product.slug,
    slug: product.slug,
    name: product.name,
    price: product.price,
    description: product.cardDescription,
    features: product.features,
    imageUrl: product.imageUrl,
    installmentEnabled: product.installmentEnabled,
    maxInstallments: product.maxInstallments,
  };

  const others = (await getPublicProducts()).filter((p) => p.slug !== product.slug);

  return (
    <>
      <JsonLdBreadcrumbList
        items={[
          { name: 'Главная', url: `${base}/` },
          { name: 'Тарифы и услуги', url: `${base}/services` },
          { name: product.name, url: pageUrl },
        ]}
      />
      <JsonLdProduct
        name={product.name}
        description={metaDescriptionFor(product.name, product.cardDescription, product.price)}
        pageUrl={pageUrl}
        price={product.price}
        imageUrl={product.imageUrl}
        siteUrl={base}
      />
      <div className="bg-[var(--bg)] text-[var(--text)]">
        <div className="mx-auto max-w-4xl px-5 pb-24 pt-20 md:px-8">
          <Breadcrumbs
            items={[
              { label: 'Главная', href: '/' },
              { label: 'Тарифы и услуги', href: '/services' },
              { label: product.name },
            ]}
          />

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {product.imageUrl ? (
              <div className="relative aspect-[3/2] w-full bg-[var(--lavender-light)] sm:aspect-[2/1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
            ) : null}
            <div className="p-7 md:p-10">
              <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{product.name}</h1>
              <p className="mt-4 leading-relaxed text-[var(--text-muted)]">{product.cardDescription}</p>

              {product.features.length > 0 && (
                <>
                  <h2 className="mt-8 font-heading text-xl font-semibold">Что входит</h2>
                  <ul className="mt-3 space-y-2 text-[var(--text-muted)]">
                    {product.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-8 text-3xl font-bold text-plum">
                {product.price <= 0 ? 'Бесплатно' : `${product.price.toLocaleString('ru-RU')} ₽`}
              </p>
              {product.installmentEnabled && product.price >= 100 && product.maxInstallments >= 2 && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Доступна рассрочка от{' '}
                  {Math.ceil(product.price / product.maxInstallments).toLocaleString('ru-RU')} ₽/мес
                </p>
              )}

              <div className="mt-6">
                <ServiceBuyButton tariff={tariff} />
              </div>

              <p className="mt-8 text-sm leading-relaxed text-[var(--text-muted)]">
                Тариф относится к курсу «{product.courseTitle}» онлайн-школы АВАТЕРРА. Программа и
                формат обучения — на{' '}
                <Link
                  href="/course/navyki-myshechnogo-testirovaniya"
                  className="text-plum underline underline-offset-4"
                >
                  странице курса
                </Link>
                . Оплата через защищённый платёжный сервис, условия — в{' '}
                <Link href="/oferta" className="text-plum underline underline-offset-4">
                  публичной оферте
                </Link>
                .
              </p>
            </div>
          </div>

          {others.length > 0 && (
            <div className="mt-12">
              <h2 className="font-heading text-xl font-semibold">Другие тарифы</h2>
              <ul className="mt-3 space-y-2">
                {others.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/services/${p.slug}`}
                      className="text-plum underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>{' '}
                    <span className="text-sm text-[var(--text-muted)]">
                      — {p.price <= 0 ? 'бесплатно' : `${p.price.toLocaleString('ru-RU')} ₽`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
