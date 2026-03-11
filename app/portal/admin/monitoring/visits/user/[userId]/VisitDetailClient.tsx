'use client';

/**
 * Таблица сессий пользователя: IP, время входа, время выхода, User-Agent.
 */
import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/portal/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SessionRow {
  id: string;
  loginAt: string;
  lastActivityAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ApiResponse {
  userId: string;
  displayName: string | null;
  period: { dateFrom: string; dateTo: string };
  items: SessionRow[];
}

function dateToParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function VisitDetailClient({ userId }: { userId: string }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return dateToParam(d);
  });
  const [dateTo, setDateTo] = useState(() => dateToParam(new Date()));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/portal/admin/monitoring/visits/user/${userId}?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      const json = await r.json();
      if (r.ok) setData(json);
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="p-4">
      {data && (
        <p className="mb-4 text-sm text-text-muted">
          Пользователь: <span className="font-medium text-dark">{data.displayName || data.userId}</span>
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          С
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          По
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>
      {loading && !data?.items?.length ? (
        <div className="py-8 text-center text-sm text-text-muted">Загрузка...</div>
      ) : !data?.items?.length ? (
        <EmptyState title="Нет сессий за период" description="Выберите другой период." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Вход</TableHead>
              <TableHead>Последняя активность</TableHead>
              <TableHead>Выход</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>User-Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{format(new Date(row.loginAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                <TableCell>{format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</TableCell>
                <TableCell>
                  {row.logoutAt ? format(new Date(row.logoutAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : '—'}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.ipAddress ?? '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-text-muted" title={row.userAgent ?? undefined}>
                  {row.userAgent ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
