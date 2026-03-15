'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Link2, Unlink } from 'lucide-react';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
}

export function CourseMediaBlock({
  courseId,
  initialAttached,
  availableMedia,
}: {
  courseId: string;
  initialAttached: MediaItem[];
  availableMedia: MediaItem[];
}) {
  const [attached, setAttached] = useState(initialAttached);
  const [available, setAvailable] = useState(availableMedia);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [detaching, setDetaching] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  async function handleAttach(mediaId: string) {
    setAttaching(mediaId);
    try {
      const res = await fetch(`/api/portal/admin/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const m = available.find((x) => x.id === mediaId);
      if (m) {
        setAttached((prev) => [...prev, m]);
        setAvailable((prev) => prev.filter((x) => x.id !== mediaId));
        setSelectedId('');
        toast.success('Медиа привязано к курсу');
      }
    } catch (e) {
      toast.error('Ошибка');
    }
    setAttaching(null);
  }

  async function handleDetach(mediaId: string) {
    setDetaching(mediaId);
    try {
      const res = await fetch(`/api/portal/admin/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const m = attached.find((x) => x.id === mediaId);
      if (m) {
        setAttached((prev) => prev.filter((x) => x.id !== mediaId));
        setAvailable((prev) => [...prev, m]);
        toast.success('Медиа отвязано');
      }
    } catch (e) {
      toast.error('Ошибка');
    }
    setDetaching(null);
  }

  return (
    <div className="portal-card p-4">
      <h2 className="text-base font-semibold text-[var(--portal-text)]">Медиа курса</h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Привязанные файлы из медиатеки отображаются в курсе.</p>
      {attached.length > 0 && (
        <ul className="mt-3 space-y-2">
          {attached.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm">
              {isPlaceholderOrExampleUrl(m.file_url) ? (
                <span className="text-[var(--portal-text-muted)]" title="Тестовая ссылка">{m.title}</span>
              ) : (
                <a href={m.file_url.startsWith('/') ? m.file_url : `/${m.file_url}`} target="_blank" rel="noopener noreferrer" className="text-[#6366F1] hover:underline">
                  {m.title}
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={detaching === m.id}
                onClick={() => handleDetach(m.id)}
                className="text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]"
              >
                <Unlink className="mr-1 h-4 w-4" />
                Отвязать
              </Button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="">Выберите файл для привязки</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!selectedId || attaching !== null}
            onClick={() => selectedId && handleAttach(selectedId)}
          >
            <Link2 className="mr-1 h-4 w-4" />
            Привязать
          </Button>
        </div>
      )}
      {attached.length === 0 && available.length === 0 && (
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Нет медиа в медиатеке или все уже привязаны к этому курсу.</p>
      )}
    </div>
  );
}
