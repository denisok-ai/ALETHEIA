import dynamic from 'next/dynamic';
import { Hero } from '@/components/sections/Hero';
import { JsonLdCourse } from '@/components/JsonLdCourse';
import { JsonLdLandingFaq } from '@/components/JsonLdLandingFaq';
import { LandingBlog } from '@/components/sections/LandingBlog';
import { LandingFAQ } from '@/components/sections/LandingFAQ';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

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
