'use client';

/**
 * Client list of notifications with mark-as-read.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { formatNotificationContent, formatNotificationType } from '@/lib/notification-content';

interface Notif {
  id: string;
  type: string;
  content: unknown;
  is_read: boolean;
  created_at: string;
}

export function NotificationsList({ initialItems }: { initialItems: Notif[] }) {
  const [items, setItems] = useState(initialItems);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleMarkRead(n: Notif) {
    if (n.is_read) return;
    setMarkingId(n.id);
    try {
      const r = await fetch(`/api/portal/notifications/${n.id}/read`, { method: 'PATCH' });
      if (!r.ok) throw new Error('Ошибка');
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      toast.success('Отмечено прочитанным');
    } catch {
      toast.error('Не удалось отметить');
    }
    setMarkingId(null);
  }

  async function handleDelete(n: Notif) {
    setDeletingId(n.id);
    try {
      const r = await fetch(`/api/portal/notifications/${n.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      setItems((prev) => prev.filter((i) => i.id !== n.id));
      toast.success('Удалено');
    } catch {
      toast.error('Не удалось удалить');
    }
    setDeletingId(null);
  }

  if (items.length === 0) {
    return (
      <div className="portal-card p-8 md:p-10 text-center">
        <p className="text-[var(--portal-text-muted)]">Нет уведомлений</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 mt-4">
      {items.map((n) => (
        <li
          key={n.id}
          className={[
            'portal-card flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 transition-all min-w-0',
            n.is_read ? 'opacity-75' : 'border-l-4 border-l-[#6366F1]',
          ].join(' ')}
        >
          <div className="min-w-0 flex-1 flex items-start gap-2 sm:gap-3">
            {!n.is_read && (
              <span className="mt-1.5 sm:mt-0 flex h-2 w-2 shrink-0 rounded-full bg-[#6366F1]" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-[var(--portal-text-soft)] uppercase tracking-wide">{formatNotificationType(n.type) || n.type}</span>
                <time className="text-xs text-[var(--portal-text-soft)]">
                  {format(new Date(n.created_at), 'dd.MM.yy HH:mm')}
                </time>
              </div>
              <p className="mt-0.5 text-sm text-[var(--portal-text)] line-clamp-2">
                {formatNotificationContent(typeof n.content === 'string' ? n.content : String(n.content ?? ''), n.type)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center pl-5 sm:pl-0">
            {!n.is_read && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleMarkRead(n)}
                disabled={markingId === n.id}
                className="min-h-9 touch-manipulation"
              >
                {markingId === n.id ? '…' : 'Прочитано'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(n)}
              disabled={deletingId === n.id}
              className="text-[var(--portal-text-soft)] hover:text-red-500 hover:bg-red-50 min-h-9 min-w-9 p-0 touch-manipulation"
              aria-label="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
