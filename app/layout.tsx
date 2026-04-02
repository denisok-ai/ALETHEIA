import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { FooterOnPublicOnly } from '@/components/FooterOnPublicOnly';
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { getSystemSettings } from '@/lib/settings';
import { AnalyticsScripts } from '@/components/AnalyticsScripts';
import { GoogleTagInHead } from '@/components/GoogleTagInHead';
import { JsonLdOrganization } from '@/components/JsonLdOrganization';
import { RootMain } from '@/components/RootMain';
import { normalizeSiteUrl } from '@/lib/site-url';

/** Без этого Next отдаёт главную и оболочку как «вечный» статический кеш (s-maxage=31536000) — после деплоя видна старая сборка. */
export const dynamic = 'force-dynamic';

const ChatBot = nextDynamic(
  () => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

/** Lora (заголовки) + Inter (тело/UI) — ближе к визуалу референса Netlify, полная кириллица; см. docs/design-notes-typography.md */
const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';

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
  return {
    metadataBase,
    title: {
      default: 'Школа кинезиологии «Аватера» — курс по мышечному тестированию',
      template: '%s | Аватера',
    },
    description:
      'Курс по обучению мышечному тестированию: узнайте, как найти причину проблемы за 30 секунд без дорогостоящих обследований. Кинезиология, тело и подсознание. Татьяна Стрельцова — более 20 лет практики, 15 000+ выпускников.',
    keywords: [
      'кинезиология',
      'мышечное тестирование',
      'Аватера',
      'AVATERRA',
      'тело не врет',
      'Татьяна Стрельцова',
      'психосоматика',
      'онлайн курс кинезиология',
    ],
    applicationName: 'Аватера',
    authors: [{ name: 'Татьяна Стрельцова', url: siteUrl }],
    creator: 'Аватера',
    publisher: 'Аватера',
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      shortcut: '/icon.svg',
      apple: '/icon.svg',
    },
    formatDetection: { telephone: false },
    verification: {
      yandex: yandexVerification,
      ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    },
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      title: 'Школа кинезиологии «Аватера» — курс по мышечному тестированию',
      description:
        'Тело помнит и знает всё: мышечное тестирование, кинезиология и программы школы «Аватера».',
      type: 'website',
      url: siteUrl,
      locale: 'ru_RU',
      siteName: 'Аватера',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Школа кинезиологии «Аватера»',
      description: 'Курс по мышечному тестированию и кинезиологии.',
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
      <head>
        <GoogleTagInHead />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_STYLESHEET} rel="stylesheet" />
      </head>
      <body className="min-h-screen font-body antialiased">
        <JsonLdOrganization siteUrl={siteUrl} phone={settings.contact_phone} />
        <AnalyticsScripts />
        <ChunkLoadRecovery />
        <SessionProvider>
          <Header />
          <RootMain>{children}</RootMain>
          <ChatBot />
          <FooterOnPublicOnly contactPhone={settings.contact_phone || undefined} />
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
