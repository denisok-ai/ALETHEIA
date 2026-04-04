'use client';

import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';

type Props = {
  phone: string;
  phoneHref: string;
};

export function ContactsPageContent({ phone, phoneHref }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Контакты' }]} />
      <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">Контакты</h1>
      <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
        Свяжитесь с школой АВАТЕРРА по телефону, email или оставьте заявку через форму на главной странице.
      </p>

      <ul className="mt-10 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <li>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Телефон</h2>
          <a href={phoneHref} className="mt-2 flex items-center gap-2 text-lg text-[var(--text)] hover:text-plum">
            <Phone className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            {phone}
          </a>
        </li>
        <li>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Email</h2>
          <a
            href="mailto:info@avaterra.pro"
            className="mt-2 flex items-center gap-2 text-[var(--text)] hover:text-plum"
          >
            <Mail className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            info@avaterra.pro
          </a>
        </li>
        <li>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Адрес</h2>
          <p className="mt-2 flex items-start gap-2 text-[var(--text-muted)]">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            Москва, ул. Здоровья, д. 10
          </p>
        </li>
      </ul>

      <p className="mt-10 text-center text-sm text-[var(--text-muted)]">
        <Link href="/#pricing" className="font-medium text-plum hover:underline">
          Записаться на курс
        </Link>
        {' · '}
        <Link href="/faq" className="font-medium text-plum hover:underline">
          Частые вопросы
        </Link>
      </p>
    </main>
  );
}
