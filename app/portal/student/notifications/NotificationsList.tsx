'use client';

/**
 * Client list of notifications with mark-as-read.
 */
import { useState } from 'react';

interface Notif {
  id: string;
  type: string;
  content: unknown;
  is_read: boolean;
  created_at: string;
}

export function NotificationsList({ initialItems }: { initialItems: Notif[] }) {
  const [items, setItems] = useState(initialItems);

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
          <span className="text-sm font-medium text-dark">{n.type}</span>
          <p className="text-sm text-text-muted">{String((n.content as { text?: string })?.text ?? '')}</p>
          <time className="text-xs text-text-soft">{new Date(n.created_at).toLocaleDateString('ru')}</time>
        </li>
      ))}
    </ul>
  );
}
