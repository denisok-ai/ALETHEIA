'use client';

/**
 * Client list of notifications with mark-as-read.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';

interface Notif {
  id: string;
  type: string;
  content: unknown;
  is_read: boolean;
  created_at: string;
}

function formatNotificationContent(type: string, content: unknown): string {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed.subject && typeof parsed.subject === 'string') return parsed.subject;
      if (parsed.course_id && type === 'enrollment') return 'Запись на курс';
      if (parsed.cert_number && type === 'certificate_issued') return `Сертификат № ${parsed.cert_number}`;
      return String(parsed.text ?? parsed.body ?? content);
    } catch {
      return content;
    }
  }
  const o = content as Record<string, unknown> | null;
  const val = o?.subject ?? o?.text ?? o?.body;
  return val != null ? String(val) : '';
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
    return <p className="mt-6 text-text-muted">Нет уведомлений</p>;
  }

  return (
    <ul className="mt-6 space-y-2">
      {items.map((n) => (
        <li
          key={n.id}
          className={`rounded-lg border p-3 ${n.is_read ? 'border-border bg-bg-soft' : 'border-primary/30 bg-white'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-dark">{n.type}</span>
              <p className="mt-0.5 text-sm text-text-muted">{formatNotificationContent(n.type, n.content)}</p>
              <time className="mt-1 block text-xs text-text-muted">{format(new Date(n.created_at), 'dd.MM.yyyy HH:mm')}</time>
            </div>
            <div className="flex items-center gap-1">
              {!n.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkRead(n)}
                  disabled={markingId === n.id}
                >
                  {markingId === n.id ? '…' : 'Прочитано'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(n)}
                disabled={deletingId === n.id}
                className="text-text-muted hover:text-red-600"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
