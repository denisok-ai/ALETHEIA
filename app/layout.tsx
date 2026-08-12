import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { FooterOnPublicOnly } from '@/components/FooterOnPublicOnly';
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { getSystemSettings } from '@/lib/settings';
import { JsonLdOrganization } from '@/components/JsonLdOrganization';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { YandexMetrika } from '@/components/YandexMetrika';
import { SiteAnalytics } from '@/components/SiteAnalytics';
import { JsonLdWebSite } from '@/components/JsonLdWebSite';
import { RootMain } from '@/components/RootMain';
import { normalizeSiteUrl } from '@/lib/site-url';
import { BRAND_LOGO_URL, BRAND_SITE_NAME } from '@/lib/brand';
import { getPublicProducts } from '@/lib/shop/public-products';

export const dynamic = 'force-dynamic';

const ChatBot = nextDynamic(
  () => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const siteUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  const yandexVerification =
    process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '0dec6f2dc03cbfd9';
  // Из БД (Портал → Настройки → google_site_verification): токен можно
  // вставить с телефона без деплоя. Env остаётся резервным путём.
  const googleSiteVerification = settings.google_site_verification?.trim();
  let metadataBase: URL;
  try {
    metadataBase = new URL(siteUrl);
  } catch {
    metadataBase = new URL('https://avaterra.pro');
  }
  const ogDescription =
    'АВАТЕРРА — онлайн-школа мышечного тестирования Татьяны Стрельцовой. Курс «Практик»: как найти причину проблемы через обратную связь тела за 30 секунд.';
  const ogTitle = 'Курс по мышечному тестированию | Школа AVATERRA';

  return {
    metadataBase,
    title: {
      default: ogTitle,
      template: '%s | АВАТЕРРА',
    },
    description: ogDescription,
    keywords: [
      'кинезиология',
      'мышечное тестирование',
      'АВАТЕРРА',
      'AVATERRA',
      'тело не врет',
      'Татьяна Стрельцова',
      'психосоматика',
      'онлайн курс кинезиология',
    ],
    applicationName: 'АВАТЕРРА',
    authors: [{ name: 'Татьяна Стрельцова', url: siteUrl }],
    creator: 'АВАТЕРРА',
    publisher: 'АВАТЕРРА',
    icons: {
      icon: [{ url: BRAND_LOGO_URL, type: 'image/png', sizes: 'any' }],
      shortcut: BRAND_LOGO_URL,
      apple: BRAND_LOGO_URL,
    },
    formatDetection: { telephone: false },
    verification: {
      yandex: yandexVerification,
      ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    },
    // Canonical задают только страницы (app/page.tsx и публичные page.tsx).
    // Корневой canonical на главную раньше мог «схлопнуть» URL без своего
    // generateMetadata в один адрес — это вредно для индексации.
    alternates: {
      types: {
        'application/rss+xml': `${siteUrl}/feed.xml`,
      },
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      url: siteUrl,
      locale: 'ru_RU',
      siteName: 'АВАТЕРРА',
      images: [
        {
          url: '/images/og/og-default.png',
          width: 1200,
          height: 630,
          alt: 'АВАТЕРРА — школа мышечного тестирования и кинезиологии',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: ['/images/og/og-default.png'],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSystemSettings();
  const siteUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  // Продуктовая линейка для hasOfferCatalog в разметке организации
  const orgOffers = (await getPublicProducts()).map((p) => ({
    name: p.name,
    price: p.price,
    slug: p.slug,
  }));
  return (
    <html lang="ru">
      <body className="min-h-screen font-body antialiased">
        <JsonLdOrganization
          siteUrl={siteUrl}
          phone={settings.contact_phone}
          offers={orgOffers.length ? orgOffers : undefined}
        />
        <JsonLdWebSite siteUrl={siteUrl} name={BRAND_SITE_NAME} />
        <YandexMetrika />
        <SiteAnalytics />
        <CookieConsentBanner />
        <ChunkLoadRecovery />
        <SessionProvider>
          <Suspense fallback={<div className="min-h-[100dvh]" aria-hidden />}>
            <Header />
            <RootMain>{children}</RootMain>
            <ChatBot />
            <FooterOnPublicOnly contactPhone={settings.contact_phone || undefined} />
          </Suspense>
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
