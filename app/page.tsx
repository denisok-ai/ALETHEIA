import dynamic from 'next/dynamic';
import { Hero } from '@/components/sections/Hero';
import { getSystemSettings } from '@/lib/settings';

// Секции ниже первого экрана — отдельные чанки (дизайн не меняется, SSR сохранён)
const HowItWorks = dynamic(() => import('@/components/sections/HowItWorks').then((m) => m.HowItWorks), { ssr: true });
const About = dynamic(() => import('@/components/sections/About').then((m) => m.About), { ssr: true });
const Program = dynamic(() => import('@/components/sections/Program').then((m) => m.Program), { ssr: true });
const Author = dynamic(() => import('@/components/sections/Author').then((m) => m.Author), { ssr: true });
const Testimonials = dynamic(() => import('@/components/sections/Testimonials').then((m) => m.Testimonials), { ssr: true });
const Pricing = dynamic(() => import('@/components/sections/Pricing').then((m) => m.Pricing), { ssr: true });
const FAQ = dynamic(() => import('@/components/sections/FAQ').then((m) => m.FAQ), { ssr: true });
const Contact = dynamic(() => import('@/components/sections/Contact').then((m) => m.Contact), { ssr: true });
const NewsWidget = dynamic(() => import('@/components/sections/NewsWidget').then((m) => m.NewsWidget), { ssr: true });

export default async function HomePage() {
  const settings = await getSystemSettings();
  const contactPhone = settings.contact_phone?.trim() || null;
  return (
    <>
      <Hero />
      <HowItWorks />
      <About />
      <Program />
      <Author />
      <Testimonials />
      <Pricing />
      <FAQ />
      <NewsWidget />
      <Contact contactPhone={contactPhone} />
    </>
  );
}
