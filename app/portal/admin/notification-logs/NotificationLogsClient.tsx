'use client';

/**
 * Notification logs table with filters.
 */
import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';

export interface LogRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  eventType: string;
  subject: string | null;
  content: string;
  channel: string;
  createdAt: string;
}

const EVENT_TYPES = [
  { value: '', label: 'Все события' },
  { value: 'enrollment', label: 'Запись на курс' },
  { value: 'certificate_issued', label: 'Сертификат выдан' },
  { value: 'enrollment_excluded', label: 'Отчисление' },
  { value: 'access_opened', label: 'Доступ открыт' },
  { value: 'access_closed', label: 'Доступ закрыт' },
];

export function NotificationLogsClient({ initialLogs }: { initialLogs: LogRow[] }) {
  const [eventFilter, setEventFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  const filtered = useMemo(() => {
    let list = initialLogs;
    if (eventFilter) list = list.filter((l) => l.eventType === eventFilter);
    if (channelFilter) list = list.filter((l) => l.channel === channelFilter);
    return list;
  }, [initialLogs, eventFilter, channelFilter]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
        >
          {EVENT_TYPES.map((e) => (
            <option key={e.value || 'all'} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
        >
          <option value="">Все каналы</option>
          <option value="internal">Внутренний</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Получатель</TableHead>
              <TableHead>Событие</TableHead>
              <TableHead>Тема</TableHead>
              <TableHead>Канал</TableHead>
              <TableHead className="max-w-[200px]">Контент (срез)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="Нет записей"
                    description="Уведомления появятся после срабатывания событий"
                    icon={<Bell className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l, idx) => (
                <TableRow key={l.id}>
                  <TableCell className="text-[var(--portal-text-muted)]">{idx + 1}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm whitespace-nowrap">
                    {format(new Date(l.createdAt), 'dd.MM.yy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.userDisplayName ?? l.userEmail ?? l.userId ?? '—'}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">{l.eventType}</TableCell>
                  <TableCell className="text-sm line-clamp-1 max-w-[180px]">{l.subject ?? '—'}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">{l.channel}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-xs line-clamp-2 max-w-[200px]">{l.content || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
