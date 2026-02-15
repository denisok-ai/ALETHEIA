import type { Metadata } from 'next';
import { Literata, Outfit } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/sections/Header';
import { Footer } from '@/components/sections/Footer';
import { StickyCTA } from '@/components/sections/StickyCTA';

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

export const metadata: Metadata = {
  title: 'ALETHEIA — Школа подсознания и мышечного тестирования',
  description:
    'Курсы кинезиологии, консультации и тренинги. Татьяна Стрельцова. Более 20 лет практики, 15 000+ человек. Москва и онлайн.',
  keywords: 'кинезиология, мышечное тестирование, подсознание, ALETHEIA, Татьяна Стрельцова',
  openGraph: {
    title: 'ALETHEIA — Школа подсознания и мышечного тестирования',
    description: 'Путь к внутренней гармонии. Консультации, курсы, тренинги.',
    type: 'website',
  },
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
        <Footer />
      </body>
    </html>
  );
}
