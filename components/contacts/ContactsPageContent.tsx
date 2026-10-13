'use client';

import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TelegramPromo } from '@/components/TelegramPromo';
import { SELLER_EMAIL, SELLER_INN, SELLER_LEGAL_ADDRESS, SELLER_LEGAL_NAME, SELLER_OGRN } from '@/lib/legal/seller';

type Props = {
  /** null, если реальный контакт не задан в настройках — см. app/contacts/page.tsx */
  phone: string | null;
  phoneHref: string | null;
  address: string | null;
  /** Метка первого касания из серверной страницы (cookie av_ref). */
  acqRef?: string | null;
};

export function ContactsPageContent({ phone, phoneHref, address, acqRef = null }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-20 font-body md:pt-24">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Контакты' }]} />
      <h1 className="font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">Контакты</h1>
      <p className="mt-4 text-[var(--text-muted)] leading-relaxed">
        Свяжитесь с школой АВАТЕРРА по телефону, email или оставьте заявку через форму на главной странице.
      </p>

      <ul className="mt-10 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        {phone && phoneHref ? (
          <li>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Телефон</h2>
            <a href={phoneHref} className="mt-2 flex items-center gap-2 text-lg text-[var(--text)] hover:text-plum">
              <Phone className="h-5 w-5 shrink-0 text-accent" aria-hidden />
              {phone}
            </a>
          </li>
        ) : null}
        <li>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Email</h2>
          <a
            href="mailto:support@avaterra.pro"
            className="mt-2 flex items-center gap-2 text-[var(--text)] hover:text-plum"
          >
            <Mail className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            support@avaterra.pro
          </a>
        </li>
        {address ? (
          <li>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-plum">Адрес</h2>
            <p className="mt-2 flex items-start gap-2 text-[var(--text-muted)]">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              {address}
            </p>
          </li>
        ) : null}
      </ul>

      <section
        id="rekvizity"
        aria-labelledby="rekvizity-heading"
        className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8"
      >
        <h2 id="rekvizity-heading" className="text-sm font-semibold uppercase tracking-wider text-plum">
          Реквизиты
        </h2>
        <p className="mt-2 text-[var(--text)]">
          Продавец курсов: {SELLER_LEGAL_NAME}. ОГРН {SELLER_OGRN}, ИНН {SELLER_INN}.
        </p>
        <p className="mt-1 text-[var(--text-muted)]">Юридический адрес: {SELLER_LEGAL_ADDRESS}.</p>
        <p className="mt-1 text-[var(--text-muted)]">
          Email для обращений: <a href={`mailto:${SELLER_EMAIL}`} className="text-plum hover:underline">{SELLER_EMAIL}</a>
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Полный текст условий — <Link href="/oferta" className="font-medium text-plum hover:underline">публичная оферта</Link>.
        </p>
      </section>

      <div className="mt-8">
        <TelegramPromo variant="card" source="contacts" acqRef={acqRef} />
      </div>

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
