'use client';

/**
 * Медиа курса: привязка файлов из медиатеки с превью, поиском и сортировкой.
 */
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Unlink, Video, FileText, Image, Music, ExternalLink, ChevronUp, ChevronDown, Film } from 'lucide-react';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';
import { EmptyState } from '@/components/ui/EmptyState';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
  mime_type?: string | null;
  thumbnail_url?: string | null;
  sort_order?: number;
}

function getMediaIcon(mimeType?: string | null) {
  if (!mimeType) return FileText;
  const t = mimeType.toLowerCase();
  if (t.startsWith('video/')) return Video;
  if (t.startsWith('audio/')) return Music;
  if (t.startsWith('image/')) return Image;
  if (t.includes('pdf')) return FileText;
  return FileText;
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
  const [attached, setAttached] = useState<MediaItem[]>(initialAttached);
  const [available, setAvailable] = useState(availableMedia);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [detaching, setDetaching] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const filteredAvailable = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return available;
    return available.filter((m) => m.title.toLowerCase().includes(q));
  }, [available, searchQuery]);

  async function handleAttach(mediaId: string) {
    setAttaching(mediaId);
    try {
      const res = await fetch(`/api/portal/admin/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, sortOrder: attached.length }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      const m = available.find((x) => x.id === mediaId);
      if (m) {
        setAttached((prev) => [...prev, { ...m, sort_order: prev.length }]);
        setAvailable((prev) => prev.filter((x) => x.id !== mediaId));
        setSelectedId('');
        toast.success('Медиа привязано к курсу');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
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
      if (!res.ok) throw new Error('Ошибка');
      const m = attached.find((x) => x.id === mediaId);
      if (m) {
        setAttached((prev) => prev.filter((x) => x.id !== mediaId));
        setAvailable((prev) => [...prev, m]);
        toast.success('Медиа отвязано');
      }
    } catch {
      toast.error('Ошибка');
    }
    setDetaching(null);
  }

  async function moveItem(index: number, direction: 'up' | 'down') {
    const newOrder = [...attached];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setAttached(newOrder);
    try {
      await Promise.all(
        newOrder.map((item, i) =>
          fetch(`/api/portal/admin/media/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, sortOrder: i }),
          })
        )
      );
      toast.success('Порядок обновлён');
    } catch {
      setAttached(attached);
      toast.error('Ошибка обновления порядка');
    }
  }

  return (
    <div className="portal-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Медиа курса</h2>
        <Link
          href="/portal/admin/media"
          className="text-sm text-[#6366F1] hover:underline flex items-center gap-1"
        >
          Медиатека
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Файлы из медиатеки, привязанные к курсу. Студенты видят их на странице курса.
      </p>

      {attached.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {attached.map((m, idx) => {
            const Icon = getMediaIcon(m.mime_type);
            const thumbUrl = m.thumbnail_url && !isPlaceholderOrExampleUrl(m.thumbnail_url) ? m.thumbnail_url : null;
            const typeLabel = m.mime_type?.split('/')[0] ?? 'файл';
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded text-[var(--portal-text-muted)] hover:bg-[#E2E8F0] disabled:opacity-30"
                    aria-label="Вверх"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 'down')}
                    disabled={idx === attached.length - 1}
                    className="p-1 rounded text-[var(--portal-text-muted)] hover:bg-[#E2E8F0] disabled:opacity-30"
                    aria-label="Вниз"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="w-12 h-12 rounded-lg bg-[#E2E8F0] flex items-center justify-center shrink-0 overflow-hidden">
                  {thumbUrl ? (
                    <img src={thumbUrl.startsWith('/') ? thumbUrl : `/${thumbUrl}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="h-6 w-6 text-[var(--portal-text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isPlaceholderOrExampleUrl(m.file_url) ? (
                    <span className="text-[var(--portal-text-muted)]" title="Тестовая ссылка">{m.title}</span>
                  ) : (
                    <a
                      href={m.file_url.startsWith('/') ? m.file_url : `/${m.file_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6366F1] hover:underline font-medium truncate block"
                    >
                      {m.title}
                    </a>
                  )}
                  <span className="text-xs text-[var(--portal-text-muted)]">{typeLabel}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href="/portal/admin/media"
                    className="p-1.5 rounded text-[var(--portal-text-muted)] hover:bg-[#E2E8F0] hover:text-[var(--portal-text)]"
                    title="Открыть медиатеку"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={detaching === m.id}
                    onClick={() => handleDetach(m.id)}
                    className="text-[var(--portal-text-muted)] hover:text-red-600"
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="mt-3 py-6"
          title="Нет привязанных медиа"
          description="Добавьте файлы из медиатеки для отображения в курсе."
          icon={<Film className="h-10 w-10" />}
        />
      )}

      {available.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-[var(--portal-text)]">Добавить из медиатеки</p>
          <Input
            type="search"
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {filteredAvailable.slice(0, 10).map((m) => {
              const Icon = getMediaIcon(m.mime_type);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAttach(m.id)}
                  disabled={attaching !== null}
                  className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm hover:bg-[#F8FAFC] disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 text-[var(--portal-text-muted)]" />
                  <span className="truncate max-w-[160px]">{m.title}</span>
                  {attaching === m.id ? (
                    <span className="text-[var(--portal-text-muted)]">…</span>
                  ) : (
                    <Link2 className="h-4 w-4 text-[#6366F1]" />
                  )}
                </button>
              );
            })}
          </div>
          {filteredAvailable.length > 10 && (
            <p className="text-xs text-[var(--portal-text-muted)]">
              Показано 10 из {filteredAvailable.length}. Уточните поиск.
            </p>
          )}
        </div>
      )}

      {attached.length === 0 && available.length === 0 && (
        <p className="mt-3 text-sm text-[var(--portal-text-muted)]">
          Медиатека пуста или все файлы уже привязаны к этому курсу.
        </p>
      )}
    </div>
  );
}
