'use client';

/**
 * Video playback with Plyr (speed, PiP, keyboard, fullscreen).
 */
import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

type Props = {
  src: string;
  title: string;
  poster?: string | null;
};

export function MediaVideoPanel({ src, title, poster }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Plyr | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const el = wrap.querySelector('video');
    if (!el) return;

    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const player = new Plyr(el, {
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'settings',
            'pip',
            'fullscreen',
          ],
          settings: ['speed'],
          keyboard: { focused: true, global: false },
          tooltips: { controls: true, seek: true },
        });
        playerRef.current = player;
      } catch {
        /* Plyr init failed — остаётся нативный video */
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [src]);

  return (
    <div ref={wrapRef} className="plyr-portal-scope w-full rounded-lg">
      <video
        key={src}
        className="block w-full max-h-[min(75vh,720px)]"
        playsInline
        preload="metadata"
        poster={poster || undefined}
        aria-label={title}
      >
        <source src={src} />
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    </div>
  );
}
