'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/portal/Card';
import { MediaCoverPlaceholder } from '@/components/portal/CourseCoverPlaceholder';
import { Play, Download, Star } from 'lucide-react';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';

export type MediaListItem = {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  category: string | null;
  description: string | null;
  type: string;
  viewsCount: number;
  allowDownload: boolean;
  ratingSum: number;
  ratingCount: number;
};

function RatingStars({
  mediaId,
  initialAvg,
  initialCount,
  onRated,
}: {
  mediaId: string;
  initialAvg: number;
  initialCount: number;
  onRated?: (avg: number, count: number) => void;
}) {
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const [submitting, setSubmitting] = useState(false);
  const [hover, setHover] = useState(0);

  async function handleRate(value: number) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/media/${mediaId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Ошибка');
        return;
      }
      setAvg(data.rating_avg ?? avg);
      setCount(data.rating_count ?? count);
      onRated?.(data.rating_avg, data.rating_count);
      toast.success('Спасибо за оценку!');
    } catch {
      toast.error('Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  const displayAvg = count > 0 ? avg.toFixed(1) : '—';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            disabled={submitting}
            onClick={() => handleRate(v)}
            onMouseEnter={() => setHover(v)}
            className="p-0.5 rounded text-amber-500 hover:text-amber-600 disabled:opacity-50"
            aria-label={`Оценка ${v}`}
          >
            <Star
              className="h-5 w-5"
              fill={hover ? (v <= hover ? 'currentColor' : 'none') : (v <= Math.round(avg) ? 'currentColor' : 'none')}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-[var(--portal-text-muted)]">
        {displayAvg} ({count})
      </span>
    </div>
  );
}

export function MediaListClient({ items }: { items: MediaListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-6 text-[var(--portal-text-muted)]">Пока нет материалов в медиатеке.</p>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => {
        const ratingAvg = m.ratingCount > 0 ? m.ratingSum / m.ratingCount : 0;
        const resType = m.type === 'link' ? 'Ссылка' : 'Файл';
        return (
          <li key={m.id}>
            <article className="portal-card h-full flex flex-col overflow-hidden
              hover:shadow-[var(--portal-shadow-md)] transition-shadow duration-200">
              {/* Обложка */}
              <Link
                href={`/portal/student/media/${m.id}`}
                className="relative block aspect-[16/9] w-full overflow-hidden bg-[#1e1340] shrink-0 group"
              >
                <MediaCoverPlaceholder
                  category={m.category}
                  title={m.title}
                  className="absolute inset-0 w-full h-full"
                />
                <span className="absolute inset-0 flex items-center justify-center
                  bg-black/0 group-hover:bg-black/25 transition-all duration-200">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full
                    bg-white/90 scale-0 group-hover:scale-100 transition-transform duration-200
                    text-[var(--portal-primary)]">
                    <Play className="h-4 w-4 ml-0.5" />
                  </span>
                </span>
              </Link>

              {/* Контент */}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex-1">
                  <Link
                    href={`/portal/student/media/${m.id}`}
                    className="font-semibold text-[var(--portal-text)] hover:text-[var(--portal-primary)]
                      text-sm leading-snug line-clamp-2 transition-colors"
                  >
                    {m.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {m.category && (
                      <span className="status-badge badge-info">{m.category}</span>
                    )}
                    <span className="status-badge badge-neutral">{resType}</span>
                    {m.viewsCount > 0 && (
                      <span className="text-[var(--portal-text-soft)]">{m.viewsCount} просм.</span>
                    )}
                  </div>
                  {m.description && (
                    <p className="mt-2 text-xs text-[var(--portal-text-muted)] line-clamp-2 leading-relaxed">
                      {m.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/portal/student/media/${m.id}`}>
                    <Button variant="primary" size="sm">
                      <Play className="h-3.5 w-3.5" /> Смотреть
                    </Button>
                  </Link>
                  {m.allowDownload && !isPlaceholderOrExampleUrl(m.fileUrl) && (
                    <a href={m.fileUrl} download target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <Download className="h-3.5 w-3.5" /> Скачать
                      </Button>
                    </a>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-[rgba(45,27,78,0.07)]">
                  <RatingStars
                    mediaId={m.id}
                    initialAvg={ratingAvg}
                    initialCount={m.ratingCount}
                  />
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
