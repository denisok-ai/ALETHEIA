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
import { AnalyticsConsentLoader } from '@/components/AnalyticsConsentLoader';
import { JsonLdWebSite } from '@/components/JsonLdWebSite';
import { RootMain } from '@/components/RootMain';
import { normalizeSiteUrl } from '@/lib/site-url';
import { BRAND_LOGO_URL, BRAND_SITE_NAME } from '@/lib/brand';

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
  const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  let metadataBase: URL;
  try {
    metadataBase = new URL(siteUrl);
  } catch {
    metadataBase = new URL('https://avaterra.pro');
  }
  const ogDescription =
    'Ваше тело знает ответ — научитесь его понимать. Курс по обучению мышечному тестированию: как найти причину проблемы за 30 секунд. Онлайн-школа AVATERRA.';
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
    alternates: {
      canonical: siteUrl,
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
          url: '/images/tatiana/tatiana-hero.png',
          width: 1024,
          height: 1280,
          alt: 'Татьяна Стрельцова — основательница школы кинезиологии АВАТЕРРА',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: ['/images/tatiana/tatiana-hero.png'],
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
  return (
    <html lang="ru">
      <body className="min-h-screen font-body antialiased">
        <JsonLdOrganization siteUrl={siteUrl} phone={settings.contact_phone} />
        <JsonLdWebSite siteUrl={siteUrl} name={BRAND_SITE_NAME} />
        <AnalyticsConsentLoader />
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
