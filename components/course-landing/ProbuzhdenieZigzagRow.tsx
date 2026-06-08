import Image from 'next/image';
import { cn } from '@/lib/utils';

export type ProbuzhdenieZigzagVisualTone = 'midnight' | 'daylight';

function renderParagraph(text: string, visualTone: ProbuzhdenieZigzagVisualTone) {
  const strongClass =
    visualTone === 'midnight' ? 'font-semibold text-white' : 'font-semibold text-plum';
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p
      className={cn(
        'leading-[1.65]',
        visualTone === 'daylight' && 'text-[var(--text)]',
        visualTone === 'midnight' && 'text-white/[0.92]',
      )}
    >
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className={strongClass}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

type ExtraTextBlock = {
  eyebrow?: string;
  title: string;
  paragraphs: string[];
};

type Props = {
  id?: string;
  imageSrc: string;
  imageAlt: string;
  /** true — картинка слева (как в примере с первым блоком). */
  imageOnLeft: boolean;
  /** Без фото: один аккуратный текстовый блок по центру (секции «Почему» / «Что делать»). */
  omitImage?: boolean;
  eyebrow?: string;
  title: string;
  largeTitle?: boolean;
  paragraphs: string[];
  /** Второй подблок текста в той же колонке (одна картинка на секцию). */
  extraTextBlocks?: ExtraTextBlock[];
  /** Например `aspect-[575/1024]` под нативные пропорции иллюстрации. */
  imageAspectClass?: string;
  list?: string[];
  listTitle?: string;
  priority?: boolean;
  showTopBorder?: boolean;
  /** `midnight` — тёмный блок; `daylight` — палитра сайта (lavender / surface). */
  visualTone?: ProbuzhdenieZigzagVisualTone;
  /** Чередование фона полосы секции (только при `visualTone="daylight"`). */
  sliceTone?: 'surface' | 'lavender' | 'none';
};

/**
 * Строка лендинга: две колонки ~50/50 (фото + текст рядом).
 * Тема `midnight` — как Tilda-референс; `daylight` — светлый бренд AVATERRA.
 */
export function ProbuzhdenieZigzagRow({
  id,
  imageSrc,
  imageAlt,
  imageOnLeft,
  omitImage = false,
  eyebrow,
  title,
  largeTitle = false,
  paragraphs,
  extraTextBlocks,
  imageAspectClass,
  list,
  listTitle,
  priority = false,
  showTopBorder = false,
  visualTone = 'midnight',
  sliceTone = 'none',
}: Props) {
  const isDay = visualTone === 'daylight';

  const sectionBand = cn(
    sliceTone === 'surface' && isDay && 'bg-[var(--surface)]',
    sliceTone === 'lavender' && isDay && 'bg-[var(--lavender-light)]',
  );

  const topBorder = cn(
    showTopBorder && isDay && 'border-t border-[var(--border)]',
    showTopBorder && !isDay && 'border-t border-white/[0.07]',
  );

  const imageCell = (
    <div
      className={cn(
        'group relative w-full max-md:order-2',
        imageAspectClass ?? 'aspect-[4/3]',
        'overflow-hidden rounded-[var(--card-radius)]',
        'shadow-[var(--shadow-card)]',
        'ring-1 transition-shadow duration-500',
        isDay ? 'ring-plum/15 hover:ring-plum/40' : 'ring-white/15 hover:ring-plum/35',
      )}
    >
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        unoptimized
        priority={priority}
        sizes="(min-width: 768px) 42vw, 100vw"
        className="object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-plum/10 via-transparent to-rose/5 opacity-80"
        aria-hidden
      />
    </div>
  );

  const textMuted = isDay ? 'text-[var(--text-muted)]' : 'text-white/[0.88]';
  const heading = isDay ? 'text-[var(--text)]' : 'text-white';

  const textCell = (
    <div
      className={cn(
        'max-md:order-1',
        isDay ? 'text-[var(--text)]' : 'text-white',
        omitImage
          ? cn(
              'mx-auto w-full max-w-2xl pl-6 md:max-w-3xl md:pl-8',
              isDay ? 'border-l-2 border-plum/35 md:border-l-[3px]' : 'border-l-2 border-rose/35 md:border-l-[3px]',
            )
          : 'md:max-w-xl lg:max-w-none',
        !omitImage && (imageOnLeft ? 'md:pl-2 lg:pl-4' : 'md:pr-2 lg:pr-4'),
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose md:text-sm">{eyebrow}</p>
      ) : null}
      {eyebrow ? (
        <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-plum to-rose/70" aria-hidden />
      ) : null}
      <h2
        className={cn(
          'mt-4 font-heading font-bold leading-[1.15] text-balance',
          heading,
          omitImage && 'text-3xl sm:text-4xl md:text-[2.4rem] lg:text-[2.65rem]',
          !omitImage &&
            (largeTitle ? 'text-3xl sm:text-4xl md:text-[2.65rem]' : 'text-2xl sm:text-3xl md:text-[2.1rem] lg:text-4xl'),
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          'mt-5 space-y-4 text-base md:text-lg',
          textMuted,
          omitImage && 'md:space-y-5 md:text-lg lg:text-xl lg:leading-relaxed',
        )}
      >
        {paragraphs.map((p, i) => (
          <div key={i}>{renderParagraph(p, visualTone)}</div>
        ))}
      </div>
      {extraTextBlocks?.map((seg, segIndex) => (
        <div
          key={segIndex}
          className={cn(
            'mt-10 pt-10',
            isDay ? 'border-t border-[var(--border)]' : 'border-t border-white/12',
            omitImage && 'md:mt-12 md:pt-12',
          )}
        >
          {seg.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose md:text-sm">{seg.eyebrow}</p>
          ) : null}
          {seg.eyebrow ? (
            <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-plum to-rose/70" aria-hidden />
          ) : null}
          <h3
            className={cn(
              'mt-4 font-heading font-bold leading-[1.15] text-balance',
              heading,
              omitImage && 'text-3xl sm:text-4xl md:text-[2.4rem] lg:text-[2.65rem]',
              !omitImage &&
                (largeTitle ? 'text-3xl sm:text-4xl md:text-[2.65rem]' : 'text-2xl sm:text-3xl md:text-[2.1rem] lg:text-4xl'),
            )}
          >
            {seg.title}
          </h3>
          <div
            className={cn(
              'mt-5 space-y-4 text-base md:text-lg',
              textMuted,
              omitImage && 'md:space-y-5 md:text-lg lg:text-xl lg:leading-relaxed',
            )}
          >
            {seg.paragraphs.map((p, i) => (
              <div key={i}>{renderParagraph(p, visualTone)}</div>
            ))}
          </div>
        </div>
      ))}
      {list?.length ? (
        <div
          className={cn(
            'mt-8 rounded-xl border p-5 md:p-6',
            isDay
              ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-soft)]'
              : 'border-white/18 bg-[#252a45]/95 text-white shadow-lg shadow-black/25',
          )}
        >
          {listTitle ? (
            <p
              className={cn(
                'mb-3 text-xs font-semibold uppercase tracking-wider',
                isDay ? 'text-plum' : 'text-[#eecce0]',
              )}
            >
              {listTitle}
            </p>
          ) : null}
          <ul
            className={cn(
              'list-none space-y-3 text-sm font-normal leading-relaxed md:text-base',
              isDay ? 'text-[var(--text)]' : 'text-white',
            )}
          >
            {list.map((item, i) => (
              <li key={i} className={cn('flex gap-3', isDay ? 'text-[var(--text)]' : 'text-white')}>
                <span
                  className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose shadow-[0_0_0_2px_rgba(206,143,176,0.45)]"
                  aria-hidden
                />
                <span className={cn('min-w-0 text-[0.9375rem] md:text-base', isDay ? 'text-[var(--text)]' : 'text-white/[0.97]')}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  if (omitImage) {
    return (
      <section id={id} className={cn('scroll-mt-28 py-14 md:py-[4.25rem] lg:py-24', sectionBand, topBorder)}>
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div
            className={cn(
              'relative overflow-hidden rounded-[var(--card-radius)] px-8 py-10 md:px-12 md:py-14 lg:px-14 lg:py-16',
              isDay
                ? 'border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]'
                : 'border border-white/12 bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-transparent shadow-2xl shadow-black/30',
            )}
          >
            <div
              className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-plum/25 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-12 right-0 h-56 w-56 rounded-full bg-rose/15 blur-3xl"
              aria-hidden
            />
            <div className="relative">{textCell}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={cn('scroll-mt-28 py-14 md:py-[4.25rem] lg:py-24', sectionBand, topBorder)}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 md:grid-cols-2 md:gap-x-12 md:gap-y-10 md:px-8 lg:gap-x-16">
        {imageOnLeft ? (
          <>
            {imageCell}
            {textCell}
          </>
        ) : (
          <>
            {textCell}
            {imageCell}
          </>
        )}
      </div>
    </section>
  );
}
