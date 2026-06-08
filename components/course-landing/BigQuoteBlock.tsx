import type { ReactNode } from 'react';

type Props = {
  title: string;
  paragraphs: string[];
  /** Tone: rose-warm (основной CTA-стиль), lavender (мягкий). */
  tone?: 'rose' | 'lavender';
  /** Опциональная подпись/иконка справа. */
  side?: ReactNode;
};

/** Большая цитата-блок с мягким фоном — для блоков «Почему так сложно?» и «Что делать?». */
export function BigQuoteBlock({ title, paragraphs, tone = 'lavender', side }: Props) {
  const bg = tone === 'rose' ? 'bg-[var(--lavender-light)] border-rose/30' : 'bg-[var(--surface)] border-[var(--border)]';
  return (
    <div className={`rounded-2xl border ${bg} p-7 shadow-[var(--shadow-soft)] md:p-9`}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <h3 className="font-heading text-2xl font-semibold text-[var(--text)] sm:text-3xl">{title}</h3>
          <div className="mt-4 space-y-4 text-[var(--text-muted)] leading-[var(--leading-body)]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
        {side ? <div className="text-plum">{side}</div> : null}
      </div>
    </div>
  );
}
