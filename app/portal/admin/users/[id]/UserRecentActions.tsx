'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/EmptyState';
import { Inbox } from 'lucide-react';

interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  createdAt: string;
}

export function UserRecentActions({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/portal/admin/audit?entityId=${encodeURIComponent(userId)}`)
      .then(async (r) => {
        if (!r.ok) return { logs: [] };
        return r.json();
      })
      .then((d) => setLogs((d.logs ?? []).slice(0, 10)))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-sm text-text-muted">Загрузка…</p>;
  if (logs.length === 0) return (
    <EmptyState
      className="py-8"
      title="Нет записей в журнале"
      description="Действия пользователя появятся здесь"
      icon={<Inbox className="h-8 w-8" />}
    />
  );

  return (
    <ul className="space-y-1 text-sm">
      {logs.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-dark">{l.action}</span>
          <span className="text-text-muted">{l.entity}</span>
          <span className="text-text-muted">{format(new Date(l.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
        </li>
      ))}
    </ul>
  );
}
