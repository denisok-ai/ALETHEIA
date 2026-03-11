'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/portal/Card';
import { Play, Download, Star } from 'lucide-react';

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
      <span className="text-sm text-text-muted">
        {displayAvg} ({count})
      </span>
    </div>
  );
}

export function MediaListClient({ items }: { items: MediaListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="mt-6 text-text-muted">Пока нет материалов в медиатеке.</p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => {
        const ratingAvg = m.ratingCount > 0 ? m.ratingSum / m.ratingCount : 0;
        const resType = m.type === 'link' ? 'Ссылка' : 'Файл';
        return (
          <li key={m.id}>
            <Card className="h-full flex flex-col">
              <div className="flex-1">
                <Link
                  href={`/portal/student/media/${m.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {m.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  {m.category && <span>{m.category}</span>}
                  <span>{resType}</span>
                  {m.viewsCount > 0 && <span>Просмотров: {m.viewsCount}</span>}
                </div>
                {m.description && (
                  <p className="mt-2 text-sm text-text-muted line-clamp-2">{m.description}</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/portal/student/media/${m.id}`}>
                  <Button variant="secondary" size="sm">
                    <Play className="mr-1.5 h-4 w-4" />
                    Смотреть
                  </Button>
                </Link>
                {m.allowDownload && (
                  <a
                    href={m.fileUrl.startsWith('http') ? m.fileUrl : m.fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm">
                      <Download className="mr-1.5 h-4 w-4" />
                      Скачать
                    </Button>
                  </a>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <RatingStars
                  mediaId={m.id}
                  initialAvg={ratingAvg}
                  initialCount={m.ratingCount}
                />
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
