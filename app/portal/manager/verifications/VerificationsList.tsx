'use client';

import { useState } from 'react';

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
    return <p className="mt-6 text-center text-text-muted">Нет заданий на проверку.</p>;
  }

  return (
    <ul className="mt-6 space-y-4">
      {list.map((item) => {
        const p = profileMap[item.user_id];
        const name = p?.display_name ?? p?.email ?? item.user_id.slice(0, 8);
        return (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-dark">{name}</p>
              <p className="text-sm text-text-muted">
                Курс: {item.course_id.slice(0, 8)}… {item.lesson_id && `• Урок: ${item.lesson_id}`}
              </p>
              <time className="text-xs text-text-soft">
                {new Date(item.created_at).toLocaleString('ru')}
              </time>
            </div>
            <div className="flex gap-2">
              <a
                href={item.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg-soft"
              >
                Смотреть видео
              </a>
              <button
                type="button"
                onClick={() => handleStatus(item.id, 'approved')}
                disabled={!!loading}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Одобрить
              </button>
              <button
                type="button"
                onClick={() => handleStatus(item.id, 'rejected')}
                disabled={!!loading}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
