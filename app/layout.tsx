import type { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { Toaster } from 'sonner';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { FooterOnPublicOnly } from '@/components/FooterOnPublicOnly';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { getSystemSettings } from '@/lib/settings';

/** Без этого Next отдаёт главную и оболочку как «вечный» статический кеш (s-maxage=31536000) — после деплоя видна старая сборка. */
export const dynamic = 'force-dynamic';

const StickyCTA = nextDynamic(() => import('@/components/sections/StickyCTA').then((m) => m.StickyCTA), { ssr: false });
const ChatBot = nextDynamic(
  () => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

/** Google Fonts через <link>: без @import в CSS (Turbopack) и без next/font (баг Turbopack с внутренним резолвером шрифтов). */
const GOOGLE_FONTS_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,100..900;1,7..72,100..900&family=Outfit:wght@100..900&display=swap';

function normalizeSiteUrl(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return 'https://avaterra.pro';
  if (!/^https?:\/\//i.test(s)) return `https://${s.replace(/^\/+/, '')}`;
  return s.replace(/\/+$/, '');
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const siteUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  let metadataBase: URL;
  try {
    metadataBase = new URL(siteUrl);
  } catch {
    metadataBase = new URL('https://avaterra.pro');
  }
  return {
    metadataBase,
    title: 'AVATERRA.PRO — Phygital школа мышечного тестирования',
    description:
      'AVATERRA — биохакинг через тело и AI. Курс «Тело не врет». Татьяна Стрельцова. Более 20 лет практики, 15 000+ человек.',
    keywords: 'кинезиология, мышечное тестирование, AVATERRA, тело не врет, Татьяна Стрельцова',
    openGraph: {
      title: 'AVATERRA.PRO — Phygital школа мышечного тестирования',
      description: 'Школа сомаватаров. Тело не врет. Консультации, курсы, тренинги.',
      type: 'website',
      url: siteUrl,
      locale: 'ru_RU',
      siteName: 'AVATERRA',
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSystemSettings();
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_STYLESHEET} rel="stylesheet" />
      </head>
      <body className="min-h-screen font-body bg-[#F8FAFC] text-[var(--portal-text)]">
        <SessionProvider>
          <Header />
          <main>{children}</main>
          <StickyCTA />
          <ChatBot />
          <FooterOnPublicOnly contactPhone={settings.contact_phone || undefined} />
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
