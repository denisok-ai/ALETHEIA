import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Literata, Outfit } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { Footer } from '@/components/sections/Footer';

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

const siteUrl = process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${literata.variable} ${outfit.variable}`}>
      <body className="min-h-screen font-body bg-bg text-dark">
        <Header />
        <main>{children}</main>
        <StickyCTA />
        <ChatBot />
        <Footer />
      </body>
    </html>
  );
}
