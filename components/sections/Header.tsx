'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_SITE_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { SocialLinks } from '@/components/SocialLinks';
import { dispatchOpenAvaterraChat } from '@/lib/chat-events';
import { isMinimalPublicShell } from '@/lib/public-shell-paths';

type SubLink = { href: string; label: string; description?: string };
type NavLink = {
  href: string;
  label: string;
  shortLabel?: string;
  children?: SubLink[];
};

const navLinks: NavLink[] = [
  { href: '#method', label: 'О методе' },
  { href: '#why', label: 'О курсе' },
  { href: '#formats', label: 'Программа' },
  { href: '#reviews', label: 'Отзывы' },
  { href: '#pricing', label: 'Цены' },
  {
    href: '/course/navyki-myshechnogo-testirovaniya',
    label: 'Курсы',
    children: [
      {
        href: '/course/navyki-myshechnogo-testirovaniya',
        label: 'Навыки мышечного тестирования',
        description: 'Авторская методика, 6 модулей, доступ 3 месяца',
      },
      {
        href: '/course/probuzhdenie',
        label: 'Пробуждение',
        description: '21 день практик осознанности — групповой и индивидуальный',
      },
    ],
  },
  { href: '/blog', label: 'Блог' },
  { href: '/about', label: 'О мастере', shortLabel: 'Мастер' },
  { href: '/faq', label: 'Вопросы и ответы', shortLabel: 'FAQ' },
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
  const [openSub, setOpenSub] = useState<string | null>(null);
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubEnter = (key: string) => {
    if (subTimer.current) clearTimeout(subTimer.current);
    setOpenSub(key);
  };
  const handleSubLeave = () => {
    if (subTimer.current) clearTimeout(subTimer.current);
    subTimer.current = setTimeout(() => setOpenSub(null), 120);
  };

  if (pathname?.startsWith('/portal') || isMinimalPublicShell(pathname)) {
    return null;
  }

  const linkClass = (...extra: (string | undefined)[]) =>
    cn(
      'shrink-0 whitespace-nowrap text-sm font-medium leading-snug tracking-tight transition-colors xl:text-[0.9375rem]',
      scrolled ? 'text-[var(--text-muted)] hover:text-[var(--text)]' : 'header-landing-text-muted hover:text-plum',
      ...extra
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
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:min-h-[4.75rem] sm:gap-3 sm:px-5 sm:py-4 md:px-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-5 xl:gap-6">
        <Link
          href={logoHref}
          className={cn(
            'relative z-20 flex min-w-0 shrink-0 items-center gap-2 font-heading text-base font-bold tracking-tight transition-colors sm:gap-2.5 sm:text-lg',
            scrolled ? 'text-[var(--text)] hover:text-plum' : 'header-landing-text hover:text-plum'
          )}
        >
          <BrandLogo
            priority
            knockout={false}
            withVisibleBrandText
            heightClass="h-10 w-auto sm:h-11 lg:h-12"
            imgClassName="max-w-[2.75rem] sm:max-w-[3rem] lg:max-w-[3.25rem]"
          />
          <span className="max-w-[6.5rem] truncate leading-tight sm:max-w-[7.5rem] lg:max-w-[8.5rem] xl:max-w-none xl:whitespace-nowrap">
            {BRAND_SITE_NAME}
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 flex-nowrap items-center justify-end gap-x-1.5 overflow-visible pl-2 sm:gap-x-2 xl:gap-x-2.5 lg:flex"
          aria-label="Основное меню"
        >
          {navLinks.map((link) => {
            const href = resolveNavHref(link.href);
            const compact = link.shortLabel ?? link.label;
            const useTitle = link.shortLabel != null && link.shortLabel !== link.label;
            const desktopOnly =
              link.href === '#method' ? 'hidden 2xl:inline-flex' : undefined;
            if (link.children && link.children.length > 0) {
              const key = link.label;
              const isOpen = openSub === key;
              return (
                <div
                  key={link.href + link.label}
                  className="relative"
                  onMouseEnter={() => handleSubEnter(key)}
                  onMouseLeave={handleSubLeave}
                  onFocus={() => handleSubEnter(key)}
                  onBlur={handleSubLeave}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={linkClass('inline-flex items-center gap-1', desktopOnly)}
                    onClick={() => setOpenSub(isOpen ? null : key)}
                  >
                    {compact}
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} aria-hidden />
                  </button>
                  <AnimatePresence>
                    {isOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        role="menu"
                        className="absolute right-0 top-full z-50 mt-2 min-w-[18rem] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl ring-1 ring-black/[0.04]"
                      >
                        {link.children.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            role="menuitem"
                            className="block rounded-xl px-3 py-2.5 text-sm text-[var(--text)] transition-colors hover:bg-plum/[0.07] hover:text-plum"
                            onClick={() => setOpenSub(null)}
                          >
                            <span className="block font-semibold">{sub.label}</span>
                            {sub.description ? (
                              <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">
                                {sub.description}
                              </span>
                            ) : null}
                          </Link>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            }
            return (
              <Link
                key={link.href + link.label}
                href={href}
                className={linkClass(desktopOnly)}
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
          <SocialLinks className="ml-1 shrink-0" iconClassName="h-[1.125rem] w-[1.125rem]" />
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
              {navLinks.map((link) => {
                if (link.children && link.children.length > 0) {
                  return (
                    <div key={link.href + link.label} className="rounded-lg pl-1">
                      <div className="py-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {link.label}
                      </div>
                      {link.children.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block rounded-lg py-2.5 pl-3 font-medium text-[var(--text)] hover:text-plum"
                          onClick={() => setOpen(false)}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  );
                }
                return (
                  <Link
                    key={link.href + link.label}
                    href={resolveNavHref(link.href)}
                    className="rounded-lg py-3 pl-1 font-medium text-[var(--text)] hover:text-plum"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
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
              <SocialLinks className="mt-4 justify-center" />
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
