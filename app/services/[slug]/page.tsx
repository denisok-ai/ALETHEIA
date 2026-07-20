/**
 * Публичная страница тарифа/услуги (SSR из БД): описание, состав, цена, покупка.
 * Product + Offer в schema.org — цены видны поисковикам и ИИ-ассистентам.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
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

import { getPublishedBlogPosts } from '@/lib/content/blog-posts';

/** 3 статьи блога для перелинковки со страницы тарифа (обратная связь блог↔продукт). */
const RELATED_ARTICLES = ['telo-znaet-otvet', 'mify-o-myshechnom-testirovanii', 'pochemu-problemy-vozvrashautysya'];

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

  // Перелинковка блог↔тариф. Список желаемых статей задан в RELATED_ARTICLES,
  // но берём только реально опубликованные: статью могли снять с публикации или
  // удалить, и ссылка на неё вела бы в никуда.
  const publishedPosts = await getPublishedBlogPosts();
  const relatedPool = publishedPosts.filter((p) => RELATED_ARTICLES.includes(p.slug));

  // Каждому тарифу — свой срез статей. Раньше все страницы показывали один и
  // тот же список, добавляя ещё несколько одинаковых абзацев к и без того
  // почти идентичным страницам. Сдвиг по слагу детерминирован: порядок не
  // «прыгает» между сборками, но у соседних тарифов подборки разные.
  const shift = [...product.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % Math.max(1, relatedPool.length);
  const relatedArticles = [...relatedPool.slice(shift), ...relatedPool.slice(0, shift)].slice(0, 3);

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

  const allProducts = await getPublicProducts();
  const others = allProducts.filter((p) => p.slug !== product.slug);

  /**
   * Чем этот тариф отличается от остальных — считаем по фактическому составу.
   *
   * Пять страниц тарифов совпадали на 86–89%: одинаковые блоки «О методе»,
   * «Кому подходит», «Что вы получите» и FAQ давали по 31 общему предложению
   * из 35. Поисковик в такой ситуации оставляет в индексе одну страницу, а
   * остальные считает копиями. Состав тарифов в базе действительно разный —
   * из него и строим текст, уникальный для каждой страницы без ручной работы.
   */
  const otherFeatures = new Set(others.flatMap((p) => p.features.map((f) => f.trim().toLowerCase())));
  const exclusiveFeatures = product.features.filter((f) => !otherFeatures.has(f.trim().toLowerCase()));

  const cheaper = others.filter((p) => p.price < product.price).sort((a, b) => b.price - a.price)[0] ?? null;
  const pricier = others.filter((p) => p.price > product.price).sort((a, b) => a.price - b.price)[0] ?? null;

  // Что даёт доплата к следующей ступени — конкретные пункты, а не «больше возможностей».
  const ownFeatureKeys = new Set(product.features.map((f) => f.trim().toLowerCase()));
  const pricierAdds = pricier
    ? pricier.features.filter((f) => !ownFeatureKeys.has(f.trim().toLowerCase())).slice(0, 4)
    : [];

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
      {/* FAQPage-разметки здесь нет намеренно: блока вопросов на странице
          больше нет, а разметка обязана описывать видимое содержимое. Кроме
          того, один и тот же FAQ, размеченный на пяти страницах сразу, Google
          расценивает как дублирующую разметку и не показывает ни на одной. */}
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
                {/* Обложка тарифа над сгибом — приоритетная загрузка + AVIF/WebP */}
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 896px) 100vw, 896px"
                  className="object-cover object-center"
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

          {/* Блоки ниже строятся из состава конкретного тарифа, поэтому у каждой
              страницы свой текст. Общее описание метода живёт на странице курса
              и в /faq — дублировать его на пяти страницах вредно для индексации. */}
          <section className="mt-14 border-t border-[var(--border)] pt-10">
            <h2 className="font-heading text-2xl font-semibold">
              Чем «{product.name}» отличается от других тарифов
            </h2>

            {exclusiveFeatures.length > 0 ? (
              <>
                <p className="mt-3 max-w-3xl leading-relaxed text-[var(--text-muted)]">
                  Что есть только здесь и не входит ни в один другой тариф:
                </p>
                <ul className="mt-4 space-y-3">
                  {exclusiveFeatures.map((f) => (
                    <li key={f} className="flex gap-3">
                      <span className="mt-1 text-plum" aria-hidden>
                        ✓
                      </span>
                      <span className="text-[var(--text-muted)]">{f}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 max-w-3xl leading-relaxed text-[var(--text-muted)]">
                Состав тарифа целиком входит и в более полные пакеты — это базовая ступень,
                с которой удобно начать и при желании перейти выше без потери оплаченного.
              </p>
            )}

            {(cheaper || pricier) && (
              <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="font-semibold text-[var(--text)]">Место в линейке</p>
                {cheaper && (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    Ступень ниже —{' '}
                    <Link href={`/services/${cheaper.slug}`} className="text-plum underline-offset-4 hover:underline">
                      {cheaper.name}
                    </Link>{' '}
                    за {cheaper.price <= 0 ? 'бесплатно' : `${cheaper.price.toLocaleString('ru-RU')} ₽`}.
                  </p>
                )}
                {pricier && (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    Ступень выше —{' '}
                    <Link href={`/services/${pricier.slug}`} className="text-plum underline-offset-4 hover:underline">
                      {pricier.name}
                    </Link>{' '}
                    за {pricier.price.toLocaleString('ru-RU')} ₽
                    {pricierAdds.length > 0 ? `; доплата добавляет: ${pricierAdds.join('; ')}.` : '.'}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-semibold">О методе и ответы на вопросы</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-[var(--text-muted)]">
              Мышечное тестирование — прикладной метод кинезиологии: тело отвечает «да/нет»
              изменением тонуса мышцы. Как это устроено, кому подходит и что получится в результате —
              подробно на{' '}
              <Link href="/course/navyki-myshechnogo-testirovaniya" className="text-plum underline-offset-4 hover:underline">
                странице курса
              </Link>
              , а разбор частых вопросов — в{' '}
              <Link href="/faq" className="text-plum underline-offset-4 hover:underline">
                разделе «Вопросы и ответы»
              </Link>
              .
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-semibold">Статьи по теме</h2>
            <ul className="mt-4 space-y-3">
              {relatedArticles
                .map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="font-semibold text-plum underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{p.description}</p>
                  </li>
                ))}
            </ul>
          </section>

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
