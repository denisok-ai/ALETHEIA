'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_SITE_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#method', label: 'О методе' },
  { href: '#why', label: 'О школе' },
  { href: '#formats', label: 'Программа' },
  { href: '#master', label: 'О мастере' },
  { href: '#reviews', label: 'Отзывы' },
  { href: '#pricing', label: 'Цены' },
  { href: '#faq', label: 'Вопросы и ответы' },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname?.startsWith('/portal')) {
    return null;
  }

  const linkClass = (extra?: string) =>
    cn(
      'text-sm font-medium transition-colors',
      scrolled ? 'text-[var(--text-muted)] hover:text-[var(--text)]' : 'header-landing-text-muted hover:text-plum',
      extra
    );

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] isolate transition-all duration-300',
        scrolled ? 'bg-[var(--surface)] shadow-sm' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex min-h-[4.25rem] max-w-6xl items-center justify-between px-5 py-4 md:min-h-[5rem] md:px-6">
        <Link
          href="#hero"
          className={cn(
            'flex items-center gap-2.5 font-heading text-xl font-bold tracking-tight transition-colors',
            scrolled ? 'text-[var(--text)] hover:text-plum' : 'header-landing-text hover:text-plum'
          )}
        >
          <BrandLogo priority knockout={scrolled} />
          <span className="max-w-[9rem] leading-tight sm:max-w-none">{BRAND_SITE_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex xl:gap-7">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass()}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={linkClass()}>
            Вход
          </Link>
          <Link href="#contact">
            <Button size="sm" variant="landingPlum" className="rounded-xl">
              Заказать звонок
            </Button>
          </Link>
        </nav>

        <button
          type="button"
          className={cn(
            'p-2 transition-colors lg:hidden',
            scrolled ? 'text-[var(--text)]' : 'text-[var(--text)]'
          )}
          aria-label="Меню"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-[var(--border)] bg-[var(--surface)] lg:hidden"
          >
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-3 font-medium text-[var(--text)] hover:text-plum"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="py-3 font-medium text-[var(--text)] hover:text-plum"
                onClick={() => setOpen(false)}
              >
                Вход
              </Link>
              <Link href="#contact" onClick={() => setOpen(false)}>
                <Button size="sm" variant="landingPlum" className="mt-2 w-full rounded-xl">
                  Заказать звонок
                </Button>
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
