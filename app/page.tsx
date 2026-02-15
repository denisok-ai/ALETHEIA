import dynamic from 'next/dynamic';
import { Hero } from '@/components/sections/Hero';

// Секции ниже первого экрана — отдельные чанки (дизайн не меняется, SSR сохранён)
const About = dynamic(() => import('@/components/sections/About').then((m) => m.About), { ssr: true });
const Program = dynamic(() => import('@/components/sections/Program').then((m) => m.Program), { ssr: true });
const Author = dynamic(() => import('@/components/sections/Author').then((m) => m.Author), { ssr: true });
const Testimonials = dynamic(() => import('@/components/sections/Testimonials').then((m) => m.Testimonials), { ssr: true });
const Pricing = dynamic(() => import('@/components/sections/Pricing').then((m) => m.Pricing), { ssr: true });
const FAQ = dynamic(() => import('@/components/sections/FAQ').then((m) => m.FAQ), { ssr: true });
const Contact = dynamic(() => import('@/components/sections/Contact').then((m) => m.Contact), { ssr: true });

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Program />
      <Author />
      <Testimonials />
      <Pricing />
      <FAQ />
      <Contact />
    </>
  );
}
