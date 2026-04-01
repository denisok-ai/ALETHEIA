'use client';

/**
 * Unified media viewer: image (zoom/pan), PDF (iframe + встроенный просмотр браузера), video (Plyr), audio, fallback.
 */
import dynamic from 'next/dynamic';
import { ExternalLink } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { isImageMime, isVideoMime, isAudioMime, isPdfMime } from '@/lib/media-mime';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';

const MediaPdfPanel = dynamic(() => import('./MediaPdfPanel').then((m) => m.MediaPdfPanel), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--portal-text-muted)] p-4">Загрузка PDF…</p>,
});

const MediaVideoPanel = dynamic(() => import('./MediaVideoPanel').then((m) => m.MediaVideoPanel), {
  ssr: false,
  loading: () => <p className="text-sm text-[var(--portal-text-muted)] p-4">Загрузка плеера…</p>,
});

export type MediaViewerProps = {
  title: string;
  src: string;
  mimeType: string;
  poster?: string | null;
};

export default function MediaViewer({ title, src, mimeType, poster }: MediaViewerProps) {
  const mime = mimeType ?? '';

  if (isPlaceholderOrExampleUrl(src)) {
    return (
      <p className="text-sm text-[var(--portal-text-muted)] py-4">
        Тестовый ресурс. Ссылка не ведёт на реальный файл (example.com или пусто).
      </p>
    );
  }

  const isImage = isImageMime(mime);
  const isVideo = isVideoMime(mime);
  const isAudio = isAudioMime(mime);
  const isPdf = isPdfMime(mime);

  if (isImage) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--portal-text-muted)]">
          Масштаб: колёсико мыши или жест pinch; перетаскивание — панорама.
        </p>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit
          wheel={{ step: 0.12 }}
          doubleClick={{ mode: 'reset' }}
        >
          <TransformComponent
            wrapperClass="!w-full max-h-[min(75vh,720px)] overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#0f172a]/5"
            contentClass="flex justify-center items-start"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed/dynamic media URL */}
            <img src={src} alt={title} className="max-w-full h-auto object-contain select-none" draggable={false} />
          </TransformComponent>
        </TransformWrapper>
      </div>
    );
  }

  if (isVideo && !isImage) {
    return <MediaVideoPanel src={src} title={title} poster={poster ?? undefined} />;
  }

  if (isAudio && !isVideo) {
    return (
      <audio controls className="w-full" src={src} preload="metadata" aria-label={title}>
        Ваш браузер не поддерживает аудио.
      </audio>
    );
  }

  if (isPdf && !isVideo && !isAudio) {
    return <MediaPdfPanel fileUrl={src} title={title} />;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-[var(--portal-text-muted)]">Предпросмотр недоступен.</p>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#6366F1] hover:underline inline-flex items-center gap-1"
      >
        <ExternalLink className="h-4 w-4" /> Открыть / Скачать
      </a>
    </div>
  );
}
