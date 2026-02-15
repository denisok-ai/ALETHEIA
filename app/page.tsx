import { Hero } from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { Program } from '@/components/sections/Program';
import { Author } from '@/components/sections/Author';
import { Testimonials } from '@/components/sections/Testimonials';
import { Pricing } from '@/components/sections/Pricing';
import { FAQ } from '@/components/sections/FAQ';
import { Contact } from '@/components/sections/Contact';

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
