/**
 * Сетка коротких вертикальных роликов (9:16) с разметкой VideoObject на каждый ролик.
 * Серверный компонент: без автоплея, видео грузится только по нажатию (preload="none").
 * Ролики и постеры отдаются с нашего домена (/uploads/clips/), CSP пропускает их через default-src 'self'.
 */
import { jsonLdString } from '@/lib/json-ld';
import {
  buildVideoObject,
  clipPosterSrc,
  clipSrc,
  getClipsForPlacement,
  type VideoClip,
} from '@/lib/content/videos';

export function VideoClips({
  placement,
  baseUrl,
  clips,
  headingId = 'video-clips-heading',
}: {
  /** 'practicum' или slug термина глоссария — выбирает ролики из каталога. */
  placement?: string;
  /** Origin сайта (из настроек), нужен для абсолютных URL в JSON-LD. */
  baseUrl: string;
  /** Явный список роликов вместо выборки по placement. */
  clips?: readonly VideoClip[];
  headingId?: string;
}) {
  const items = clips ?? (placement ? getClipsForPlacement(placement) : []);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="font-heading text-lg font-semibold text-[var(--text)]">
        Короткие ролики школы
      </h2>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((clip) => (
          <li key={clip.slug}>
            <figure className="m-0">
              <video
                className="aspect-[9/16] w-full rounded-2xl bg-black object-cover shadow-[var(--shadow-soft)]"
                controls
                preload="none"
                playsInline
                poster={clipPosterSrc(clip, 'jpg')}
                aria-label={clip.title}
              >
                <source src={clipSrc(clip)} type="video/mp4" />
                Ваш браузер не воспроизводит видео. Ролик доступен по ссылке: {clipSrc(clip)}
              </video>
              <figcaption className="mt-2 text-sm font-medium text-[var(--text)]">{clip.title}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {items.map((clip) => (
        <script
          key={`ld-${clip.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(buildVideoObject(clip, baseUrl)) }}
        />
      ))}
    </section>
  );
}
