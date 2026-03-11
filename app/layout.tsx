import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Literata, Outfit } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { FooterOnPublicOnly } from '@/components/FooterOnPublicOnly';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { getSystemSettings } from '@/lib/settings';

const StickyCTA = dynamic(() => import('@/components/sections/StickyCTA').then((m) => m.StickyCTA), { ssr: false });
const ChatBot = dynamic(
  () => import('@/components/ChatBot').then((m) => ({ default: m.ChatBot })),
  { ssr: false }
);

const literata = Literata({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-literata',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const siteUrl = settings.site_url || process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';
  return {
    metadataBase: new URL(siteUrl),
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
    <html lang="ru" className={`${literata.variable} ${outfit.variable}`}>
      <body className="min-h-screen font-body bg-bg text-dark">
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
