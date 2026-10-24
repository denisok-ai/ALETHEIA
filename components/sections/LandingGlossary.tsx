import Link from 'next/link';
import { landingGlossaryCards } from '@/lib/content/landing-glossary';

/** Карточки терминов глоссария на главной — ссылки на /glossary/<slug> (перелинковка, см. lib/content/landing-glossary.ts). */
export function LandingGlossary() {
  const cards = landingGlossaryCards();
  if (!cards.length) return null;

  return (
    <section
      id="slovar"
      className="relative border-t border-[var(--border)] bg-[var(--bg)] py-14 px-4 sm:px-5 md:py-20 md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="block text-sm font-semibold uppercase tracking-widest text-plum">Словарь</span>
            <h2 className="mt-2 font-heading text-3xl font-semibold text-[var(--text)] sm:text-4xl">
              Словарь телесных практик
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--text-muted)] leading-relaxed">
              Короткие определения терминов, которые встречаются в статьях и практикуме школы Аватэрра.
            </p>
          </div>
          <Link
            href="/glossary"
            className="shrink-0 text-sm font-semibold text-plum underline decoration-plum/35 underline-offset-4 transition-colors hover:text-plum/90"
          >
            Весь словарь
          </Link>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {cards.map((card) => (
            <li key={card.slug}>
              <Link
                href={`/glossary/${card.slug}`}
                className="group flex h-full min-h-[10rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] transition-all hover:border-plum/30 hover:shadow-[var(--shadow-card)] md:p-6"
              >
                <h3 className="border-l-[3px] border-plum/80 pl-3 font-heading text-lg font-semibold leading-snug text-[var(--text)] transition-colors group-hover:text-plum">
                  {card.term}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{card.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-plum">
                  Определение
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
