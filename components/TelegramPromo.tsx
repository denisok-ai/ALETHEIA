/**
 * Промо-блок Telegram-бота школы (@AvaterraProBot) с второстепенной ссылкой на
 * канал. Один компонент для трёх мест: конец статьи блога, секция на главной,
 * страница «Контакты» — вид регулируется пропом variant.
 *
 * Что честно обещаем: бот отвечает на вопросы о методе и школе, помогает выбрать
 * курс, а записавшимся показывает прогресс и сертификат. Без выдуманных функций.
 */
import { SOCIAL_LINKS, TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from '@/lib/social-links';

function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.94 4.66a1.28 1.28 0 0 0-1.32-.18L2.93 11.3a1.2 1.2 0 0 0 .09 2.23l4.74 1.58 1.82 5.52a1.2 1.2 0 0 0 1.87.5l2.6-2.28 4.83 3.56a1.2 1.2 0 0 0 1.9-.78l2.14-15.47ZM9.28 13.87l8.11-5.05-6.2 6.72-.28 2.98 2.37-4.65Z" />
    </svg>
  );
}

const BENEFITS = [
  'Ответит на вопросы о мышечном тестировании и школе',
  'Поможет выбрать курс под ваш запрос',
  'Студентам — прогресс по курсу и сертификат под рукой',
];

type Variant = 'section' | 'card';

export function TelegramPromo({ variant = 'card' }: { variant?: Variant }) {
  const inner = (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-plum/[0.10] blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-plum">
            <TelegramGlyph className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-widest">Telegram-бот школы</span>
          </div>
          <h2 className="mt-3 font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl">
            Задайте вопрос о методе прямо в Telegram
          </h2>
          <ul className="mt-4 space-y-2 text-[var(--text-muted)]">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-plum" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 md:w-56">
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-plum px-5 py-3 font-semibold text-white transition-colors hover:bg-plum/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            <TelegramGlyph className="h-5 w-5" />
            Открыть бота
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-plum hover:text-plum"
          >
            Подписаться на канал
          </a>
          <p className="text-center text-xs text-[var(--text-muted)]">{TELEGRAM_BOT_USERNAME}</p>
        </div>
      </div>
    </div>
  );

  if (variant === 'section') {
    return (
      <section
        id="telegram"
        className="relative border-t border-[var(--border)] bg-[var(--lavender-light)] px-4 py-14 sm:px-5 md:py-20 md:px-6"
      >
        <div className="mx-auto max-w-6xl">{inner}</div>
      </section>
    );
  }
  return inner;
}
