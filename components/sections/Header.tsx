'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#why', label: 'Почему мы' },
  { href: '#formats', label: 'Форматы' },
  { href: '#master', label: 'О мастере' },
  { href: '#reviews', label: 'Отзывы' },
  { href: '#pricing', label: 'Тарифы' },
  { href: '#faq', label: 'FAQ' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-white/95 shadow-sm backdrop-blur-md' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex min-h-[4.25rem] max-w-6xl items-center justify-between px-5 py-4 md:min-h-[5rem] md:px-6">
        <Link
          href="#hero"
          className={cn(
            'flex items-center gap-2.5 font-heading text-xl font-bold tracking-tight transition-colors',
            scrolled ? 'text-gray-900 hover:text-gray-700' : 'text-gray-900 hover:opacity-90'
          )}
        >
          <img
            src="/images/avaterra-logo.png?v=1"
            alt=""
            width={71}
            height={71}
            className="h-[4.4375rem] w-[4.4375rem] shrink-0 object-contain"
          />
          <span>AVATERRA</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                scrolled
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-gray-900 hover:text-violet-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href="#contact">
            <Button
              size="sm"
              className="rounded-xl bg-amber-700/90 text-white hover:bg-amber-800 shadow-md border-0"
            >
              Запишись
            </Button>
          </Link>
        </nav>

        <button
          type="button"
          className={cn('md:hidden p-2 transition-colors', scrolled ? 'text-gray-900' : 'text-gray-900')}
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
            className="md:hidden border-t border-white/20 bg-violet-900/95 backdrop-blur-md"
          >
            <nav className="flex flex-col gap-2 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn('py-3 text-white font-medium hover:text-white/90')}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="#contact" onClick={() => setOpen(false)}>
                <Button
                  size="sm"
                  className="mt-2 w-full rounded-xl bg-amber-700/90 text-white hover:bg-amber-800 border-0"
                >
                  Запишись
                </Button>
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
