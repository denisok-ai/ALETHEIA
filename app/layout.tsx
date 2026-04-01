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
import { normalizeSiteUrl } from '@/lib/site-url';

/** Без этого Next отдаёт главную и оболочку как «вечный» статический кеш (s-maxage=31536000) — после деплоя видна старая сборка. */
export const dynamic = 'force-dynamic';

const ChatBot = nextDynamic(
  () => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

/** Google Fonts через <link>: без @import в CSS (Turbopack) и без next/font (баг Turbopack с внутренним резолвером шрифтов). */
const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,100..900;1,7..72,100..900&family=Outfit:wght@100..900&display=swap';

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
      default: 'AVATERRA.PRO — Phygital школа мышечного тестирования',
      template: '%s | AVATERRA',
    },
    description:
      'AVATERRA — Phygital школа мышечного тестирования: биохакинг через тело, работа с подсознанием, баланс. Курс «Тело не врет». Татьяна Стрельцова — более 20 лет практики, 15 000+ консультаций.',
    keywords: [
      'кинезиология',
      'мышечное тестирование',
      'AVATERRA',
      'тело не врет',
      'Татьяна Стрельцова',
      'психосоматика',
      'биохакинг',
      'онлайн курс кинезиология',
    ],
    applicationName: 'AVATERRA',
    authors: [{ name: 'Татьяна Стрельцова', url: siteUrl }],
    creator: 'AVATERRA',
    publisher: 'AVATERRA',
    formatDetection: { telephone: false },
    verification: {
      yandex: yandexVerification,
      ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    },
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      title: 'AVATERRA.PRO — Phygital школа мышечного тестирования',
      description:
        'Мышечное тестирование, кинезиология, курсы и менторство. Тело не врет — проверьте на практике.',
      type: 'website',
      url: siteUrl,
      locale: 'ru_RU',
      siteName: 'AVATERRA',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AVATERRA.PRO — школа мышечного тестирования',
      description: 'Кинезиология и работа с телом. Курсы AVATERRA.',
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
      <body className="min-h-screen font-body bg-[#F8FAFC] text-[var(--portal-text)]">
        <JsonLdOrganization siteUrl={siteUrl} phone={settings.contact_phone} />
        <AnalyticsScripts />
        <ChunkLoadRecovery />
        <SessionProvider>
          <Header />
          <main>{children}</main>
          <ChatBot />
          <FooterOnPublicOnly contactPhone={settings.contact_phone || undefined} />
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
