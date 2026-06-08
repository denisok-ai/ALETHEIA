import type { ReactNode } from 'react';

type Props = {
  id?: string;
  eyebrow?: string;
  /** Если не задан — блок заголовка над `children` не рендерится (имя может быть внутри контента). */
  title?: string;
  description?: string;
  /** Цвет фона: основной, сюрфейс, или мягкий лавандовый. */
  tone?: 'bg' | 'surface' | 'lavender';
  children: ReactNode;
  /** Заголовок без `border-t`, например, сразу после Hero. */
  noTopBorder?: boolean;
};

const TONE_BG: Record<NonNullable<Props['tone']>, string> = {
  bg: 'bg-[var(--bg)]',
  surface: 'bg-[var(--surface)]',
  lavender: 'bg-[var(--lavender-light)]',
};

/** Универсальная секция в стиле главной: одна и та же типографика и отступы для всех блоков лендинга. */
export function LandingSection({
  id,
  eyebrow,
  title,
  description,
  tone = 'bg',
  children,
  noTopBorder,
}: Props) {
  const hasIntro = Boolean(eyebrow || title || description);
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 ${noTopBorder ? '' : 'border-t border-[var(--border)]'} ${TONE_BG[tone]} py-9 px-5 md:py-12 md:px-6`}
    >
      <div className="relative mx-auto max-w-6xl">
        {hasIntro ? (
          <div className="max-w-3xl">
            {eyebrow ? (
              <span className="block text-xs font-semibold uppercase tracking-widest text-plum sm:text-sm">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2
                className={
                  eyebrow
                    ? 'mt-1.5 font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl'
                    : 'font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl'
                }
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 text-[var(--text-muted)] leading-relaxed">{description}</p>
            ) : null}
          </div>
        ) : null}
        <div className={hasIntro ? 'mt-6 md:mt-8' : undefined}>{children}</div>
      </div>
    </section>
  );
}
