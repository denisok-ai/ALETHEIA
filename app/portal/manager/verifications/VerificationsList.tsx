'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ExternalLink, Check, X, Video } from 'lucide-react';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';

interface Item {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  lesson_id: string | null;
  video_url: string;
  status: string;
  created_at: string;
}

export function VerificationsList({
  items,
  profileMap,
  /** Base path for user link: /portal/manager/users (manager) or /portal/admin/users (admin). */
  userHrefPrefix,
}: {
  items: Item[];
  profileMap: Record<string, { display_name?: string; email?: string }>;
  userHrefPrefix?: string;
}) {
  const [list, setList] = useState(items);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  async function handleStatus(id: string, status: 'approved' | 'rejected', comment?: string) {
    setLoading(id);
    setRejectingId(null);
    setRejectComment('');
    try {
      const res = await fetch('/api/portal/manager/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(status === 'rejected' && comment !== undefined && { comment }) }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Ошибка при изменении статуса';
        try {
          const data = JSON.parse(text);
          if (data?.error) msg = data.error;
        } catch {
          if (text) msg = text.slice(0, 100);
        }
        toast.error(msg);
        return;
      }
      setList((prev) => prev.filter((i) => i.id !== id));
      toast.success(status === 'approved' ? 'Одобрено' : 'Отклонено');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка соединения');
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
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      {list.map((item) => {
        const p = profileMap[item.user_id];
        const name = p?.display_name ?? p?.email ?? item.user_id.slice(0, 8);
        const busy = loading === item.id;
        return (
          <li
            key={item.id}
            className="portal-card flex flex-col gap-3 p-4 md:p-5 min-w-0 hover:shadow-[var(--portal-shadow)] transition-shadow"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--portal-text)]">
                {userHrefPrefix ? (
                  <Link href={`${userHrefPrefix}/${item.user_id}`} className="hover:text-[var(--portal-accent)] hover:underline">
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </p>
              <p className="text-sm text-[var(--portal-text-muted)] mt-0.5">
                {item.course_title || item.course_id}
                {item.lesson_id && ` • Урок: ${item.lesson_id}`}
              </p>
              <time className="text-xs text-[var(--portal-text-soft)] block mt-1">
                {new Date(item.created_at).toLocaleString('ru', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </time>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {isPlaceholderOrExampleUrl(item.video_url) ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text-muted)] bg-[#F8FAFC]"
                  title="В тестовых данных ссылка не ведёт на реальное видео"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Смотреть видео (тест)
                </span>
              ) : (
                <a
                  href={item.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[var(--portal-text)] hover:bg-[#F8FAFC] hover:border-[#C7D2FE] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Смотреть видео
                </a>
              )}
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
              {rejectingId === item.id ? (
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Комментарий для студента (необязательно)"
                    rows={2}
                    className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleStatus(item.id, 'rejected', rejectComment)}
                      disabled={!!loading}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Отклонить
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setRejectingId(null); setRejectComment(''); }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setRejectingId(item.id)}
                  disabled={!!loading}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Отклонить
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
