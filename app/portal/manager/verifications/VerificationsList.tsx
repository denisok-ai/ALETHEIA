'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Check, X, Video } from 'lucide-react';

interface Item {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  video_url: string;
  status: string;
  created_at: string;
}

export function VerificationsList({
  items,
  profileMap,
}: {
  items: Item[];
  profileMap: Record<string, { display_name?: string; email?: string }>;
}) {
  const [list, setList] = useState(items);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStatus(id: string, status: 'approved' | 'rejected') {
    setLoading(id);
    try {
      const res = await fetch('/api/portal/manager/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setList((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    }
    setLoading(null);
  }

  if (list.length === 0) {
    return (
      <div className="portal-card p-10 text-center">
        <Video className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Нет заданий на проверку</h2>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Новые видео появятся здесь.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map((item) => {
        const p = profileMap[item.user_id];
        const name = p?.display_name ?? p?.email ?? item.user_id.slice(0, 8);
        const busy = loading === item.id;
        return (
          <li
            key={item.id}
            className="portal-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:shadow-[var(--portal-shadow)] transition-shadow"
          >
            <div className="min-w-0">
              <p className="font-medium text-[var(--portal-text)]">{name}</p>
              <p className="text-sm text-[var(--portal-text-muted)]">
                Курс: {item.course_id.slice(0, 8)}… {item.lesson_id && `• Урок: ${item.lesson_id}`}
              </p>
              <time className="text-xs text-[var(--portal-text-soft)]">
                {new Date(item.created_at).toLocaleString('ru')}
              </time>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <a
                href={item.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:border-[#C7D2FE] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Смотреть видео
              </a>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleStatus(item.id, 'approved')}
                disabled={!!loading}
                className="!bg-[#15803D] hover:!bg-[#166534]"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Одобрить
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleStatus(item.id, 'rejected')}
                disabled={!!loading}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Отклонить
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
