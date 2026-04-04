'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mail, MapPin, Phone } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_SCHOOL_LINE, BRAND_SITE_NAME } from '@/lib/brand';

interface FooterProps {
  /** Из настроек портала (БД). Если не задан — показывается заглушка. */
  contactPhone?: string | null;
}

export function Footer({ contactPhone }: FooterProps) {
  const phone = contactPhone?.trim() || '+7 (495) 123-45-67';
  const phoneHref = phone.replace(/\D/g, '').length >= 10 ? `tel:${phone.replace(/\D/g, '')}` : '#';
  return (
    <footer id="footer" className="border-t border-[var(--border)] bg-[var(--lavender-light)] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="grid gap-12 md:grid-cols-3 text-center md:text-left">
          <div>
            <Link
              href="#hero"
              className="inline-flex items-center gap-2 font-heading text-xl font-semibold text-[var(--text)] hover:text-plum transition-colors"
            >
              <BrandLogo knockout={false} withVisibleBrandText heightClass="h-[3.9375rem]" />
              <span>{BRAND_SITE_NAME}</span>
            </Link>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{BRAND_SCHOOL_LINE}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">
              Партнёры: Институт им. Энгельгардта, РНИМУ им. Пирогова
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text)] mb-2">Контакты</p>
            <ul className="space-y-1 text-sm text-[var(--text-muted)]">
              <li>
                <a
                  href={phoneHref}
                  className="flex items-center justify-center gap-2 md:justify-start hover:text-plum transition-colors"
                >
                  <Phone className="h-4 w-4" /> {phone}
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@avaterra.pro"
                  className="flex items-center justify-center gap-2 md:justify-start hover:text-plum transition-colors"
                >
                  <Mail className="h-4 w-4" /> info@avaterra.pro
                </a>
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <MapPin className="h-4 w-4" /> Москва, ул. Здоровья, д. 10
              </li>
            </ul>
          </div>
          <div>
            <Link href="#pricing" className={cn(buttonVariants({ variant: 'landingRose' }))}>
              Купить курс
            </Link>
            <nav
              className="mt-4 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 text-xs text-[var(--text-soft)]"
              aria-label="Разделы сайта"
            >
              <Link href="/" className="hover:text-plum transition-colors">
                Главная
              </Link>
              <Link href="/course/navyki-myshechnogo-testirovaniya" className="hover:text-plum transition-colors">
                Курс «Навыки мышечного тестирования»
              </Link>
              <Link href="/about" className="hover:text-plum transition-colors">
                О мастере
              </Link>
              <Link href="/blog" className="hover:text-plum transition-colors">
                Блог
              </Link>
              <Link href="/faq" className="hover:text-plum transition-colors">
                Вопросы и ответы
              </Link>
              <Link href="/contacts" className="hover:text-plum transition-colors">
                Контакты
              </Link>
              <Link href="/oferta" className="hover:text-plum transition-colors">
                Оферта
              </Link>
              <Link href="/privacy" className="hover:text-plum transition-colors">
                Политика конфиденциальности
              </Link>
            </nav>
          </div>
        </div>
        <p className="mt-8 pt-6 border-t border-[var(--border)] text-center text-xs text-[var(--text-soft)]">
          ©&nbsp;{BRAND_SITE_NAME}. ИП Стрельцова Т. (ОГРН и реквизиты уточняются)
        </p>
      </div>
    </footer>
  );
}
