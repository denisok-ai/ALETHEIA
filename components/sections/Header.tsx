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
import { dispatchOpenAvaterraChat } from '@/lib/chat-events';

const navLinks: { href: string; label: string; shortLabel?: string }[] = [
  { href: '#method', label: 'О методе' },
  { href: '#why', label: 'О курсе' },
  { href: '#formats', label: 'Программа' },
  { href: '#reviews', label: 'Отзывы' },
  { href: '#pricing', label: 'Цены' },
  { href: '/course/navyki-myshechnogo-testirovaniya', label: 'Курс по тестированию', shortLabel: 'Курс' },
  { href: '/blog', label: 'Блог' },
  { href: '/about', label: 'О мастере', shortLabel: 'Мастер' },
  { href: '/faq', label: 'Вопросы и ответы' },
  { href: '/contacts', label: 'Контакты' },
];

/** Якоря главной: всегда `/#id` — в App Router чистый `#id` у Link часто не скроллит к секции. */
function resolveNavHref(href: string): string {
  if (href.startsWith('#')) {
    return `/${href}`;
  }
  return href;
}

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
      'shrink-0 whitespace-nowrap text-sm font-medium leading-snug tracking-tight transition-colors 3xl:text-[0.9375rem]',
      scrolled ? 'text-[var(--text-muted)] hover:text-[var(--text)]' : 'header-landing-text-muted hover:text-plum',
      extra
    );

  const loginNavClass = cn(
    'shrink-0 whitespace-nowrap text-sm font-semibold leading-snug tracking-tight transition-colors 3xl:text-[0.9375rem]',
    'ml-0.5 rounded-lg border-2 border-plum/55 bg-plum/[0.08] px-3 py-2 text-plum shadow-sm ring-1 ring-plum/25',
    'hover:border-plum hover:bg-plum/[0.14] hover:text-plum hover:ring-plum/40',
    scrolled && 'border-plum/45 bg-plum/[0.06] ring-plum/20'
  );

  const logoHref = pathname === '/' ? '#hero' : '/';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] isolate transition-all duration-300',
        scrolled ? 'bg-[var(--surface)] shadow-sm' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:min-h-[4.75rem] sm:px-5 sm:py-4 md:min-h-[5.25rem] md:px-6">
        <Link
          href={logoHref}
          className={cn(
            'flex shrink-0 items-center gap-2.5 font-heading text-lg font-bold tracking-tight transition-colors sm:text-xl',
            scrolled ? 'text-[var(--text)] hover:text-plum' : 'header-landing-text hover:text-plum'
          )}
        >
          <BrandLogo
            priority
            knockout={false}
            withVisibleBrandText
            heightClass="h-14 w-auto sm:h-16 md:h-[4.5rem]"
            imgClassName="max-w-[min(100%,10rem)] sm:max-w-[11rem] md:max-w-[13rem]"
          />
          <span className="max-w-[8.5rem] truncate leading-tight sm:max-w-none sm:whitespace-nowrap">
            {BRAND_SITE_NAME}
          </span>
        </Link>

        <nav
          className="scrollbar-thin hidden min-w-0 max-w-[min(100vw-12rem,56rem)] flex-1 flex-nowrap items-center justify-end gap-x-2 overflow-x-auto 3xl:gap-x-[0.875rem] lg:flex"
          aria-label="Основное меню"
        >
          {navLinks.map((link) => {
            const href = resolveNavHref(link.href);
            const compact = link.shortLabel ?? link.label;
            const useTitle = link.shortLabel != null && link.shortLabel !== link.label;
            return (
              <Link
                key={link.href + link.label}
                href={href}
                className={linkClass()}
                title={useTitle ? link.label : undefined}
              >
                {compact}
              </Link>
            );
          })}
          <Link href="/login" className={loginNavClass}>
            Вход
          </Link>
          <Button
            type="button"
            size="sm"
            variant="landingPlum"
            className="ml-1 shrink-0 rounded-xl whitespace-nowrap text-sm 3xl:text-[0.9375rem]"
            onClick={() => dispatchOpenAvaterraChat()}
          >
            Задать вопрос
          </Button>
        </nav>

        <button
          type="button"
          className={cn(
            'shrink-0 p-2 transition-colors lg:hidden',
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
            <nav className="flex flex-col gap-0.5 p-4 text-base" aria-label="Мобильное меню">
              {navLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={resolveNavHref(link.href)}
                  className="rounded-lg py-3 pl-1 font-medium text-[var(--text)] hover:text-plum"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="mt-1 rounded-xl border border-plum/40 bg-plum/[0.08] px-3 py-3 text-center font-semibold text-plum shadow-sm hover:bg-plum/[0.14]"
                onClick={() => setOpen(false)}
              >
                Вход
              </Link>
              <Button
                type="button"
                size="sm"
                variant="landingPlum"
                className="mt-2 w-full rounded-xl"
                onClick={() => {
                  setOpen(false);
                  dispatchOpenAvaterraChat();
                }}
              >
                Задать вопрос
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
