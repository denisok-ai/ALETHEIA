import { cn } from '@/lib/utils';

type InterludeTone = 'midnight' | 'soft';

/** Разделитель между группами зигзаг-блоков — `midnight` (Tilda) или `soft` в палитре сайта. */
export function ProbuzhdenieDarkInterlude({
  kicker,
  title,
  className,
  tone = 'midnight',
}: {
  kicker: string;
  title: string;
  className?: string;
  tone?: InterludeTone;
}) {
  return (
    <div
      className={cn(
        'px-4 py-10 md:py-12',
        tone === 'midnight' &&
          'border-y border-white/[0.08] bg-gradient-to-r from-[#2a2540]/80 via-[#1e1b32]/95 to-[#2a2540]/80',
        tone === 'soft' &&
          'border-y border-[var(--border)] bg-gradient-to-r from-[var(--lavender-light)] via-[var(--lavender)]/80 to-[var(--lavender-light)]',
        className,
      )}
      role="presentation"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p
          className={cn(
            'text-[0.65rem] font-semibold uppercase tracking-[0.35em] md:text-xs',
            tone === 'midnight' && 'text-rose/95',
            tone === 'soft' && 'text-plum',
          )}
        >
          {kicker}
        </p>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-plum to-transparent opacity-90" />
        <p
          className={cn(
            'mt-5 font-heading text-lg font-semibold leading-snug md:text-xl',
            tone === 'midnight' && 'text-white',
            tone === 'soft' && 'text-[var(--text)]',
          )}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
