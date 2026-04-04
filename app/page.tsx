import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AnalyticsHomeEngagement } from '@/components/AnalyticsHomeEngagement';
import { Hero } from '@/components/sections/Hero';
import { JsonLdCourse } from '@/components/JsonLdCourse';
import { JsonLdLandingFaq } from '@/components/JsonLdLandingFaq';
import { LandingBlog } from '@/components/sections/LandingBlog';
import { LandingFAQ } from '@/components/sections/LandingFAQ';
import { getSystemSettings } from '@/lib/settings';
import { DEFAULT_OG_IMAGE_PATH, SEO_HOME } from '@/lib/seo/pages';
import { normalizeSiteUrl } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const canonical = `${base}/`;
  const ogImageAbs = `${base}${DEFAULT_OG_IMAGE_PATH}`;
  return {
    title: { absolute: SEO_HOME.title },
    description: SEO_HOME.description,
    alternates: { canonical },
    openGraph: {
      title: SEO_HOME.title,
      description: SEO_HOME.description,
      url: canonical,
      type: 'website',
      locale: 'ru_RU',
      siteName: 'АВАТЕРРА',
      images: [{ url: ogImageAbs, width: 1024, height: 1280, alt: SEO_HOME.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: SEO_HOME.title,
      description: SEO_HOME.description,
      images: [ogImageAbs],
    },
    robots: { index: true, follow: true },
  };
}

// Секции ниже первого экрана — отдельные чанки (дизайн не меняется, SSR сохранён)
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks').then((m) => m.HowItWorks), { ssr: true });
const About = dynamic(() => import('@/components/sections/About').then((m) => m.About), { ssr: true });
const Program = dynamic(() => import('@/components/sections/Program').then((m) => m.Program), { ssr: true });
const Author = dynamic(() => import('@/components/sections/Author').then((m) => m.Author), { ssr: true });
const Testimonials = dynamic(() => import('@/components/sections/Testimonials').then((m) => m.Testimonials), { ssr: true });
const Pricing = dynamic(() => import('@/components/sections/Pricing').then((m) => m.Pricing), { ssr: true });
const FAQ = dynamic(() => import('@/components/sections/FAQ').then((m) => m.FAQ), { ssr: true });
export default async function HomePage() {
  const settings = await getSystemSettings();
  const siteUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  return (
    <>
      <AnalyticsHomeEngagement />
      <JsonLdCourse siteUrl={siteUrl} />
      <JsonLdLandingFaq />
      <Hero />
      <HowItWorks />
      <About />
      <Program />
      <Author />
      <Testimonials />
      <LandingBlog />
      <LandingFAQ />
      <Pricing />
      <FAQ />
    </>
  );
}
