'use client';

/**
 * Таблица сессий пользователя: IP, время входа/выхода и системное окружение
 * (браузер, ОС, устройство из User-Agent — lib/ua-parse). Полный User-Agent
 * доступен в тултипе колонки «Браузер».
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
import { toast } from 'sonner';
import { parseUserAgent } from '@/lib/ua-parse';

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

function safeFormat(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd.MM.yyyy HH:mm', { locale: ru });
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
      const q = new URLSearchParams({ dateFrom, dateTo });
      const r = await fetch(
        `/api/portal/admin/monitoring/visits/user/${encodeURIComponent(userId)}?${q.toString()}`,
        { credentials: 'same-origin' }
      );
      const text = await r.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        toast.error('Ответ сервера не JSON. Обновите страницу или войдите снова.');
        return;
      }
      if (!r.ok) {
        const body = json && typeof json === 'object' && json !== null ? (json as { error?: unknown }) : null;
        const message =
          body && typeof body.error === 'string' ? body.error : `Ошибка загрузки (${r.status})`;
        toast.error(message);
        return;
      }
      setData(json as ApiResponse);
    } catch (e) {
      console.error(e);
      toast.error('Не удалось загрузить данные');
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
        <p className="mb-4 text-sm text-[var(--portal-text-muted)]">
          Пользователь: <span className="font-medium text-[var(--portal-text)]">{data.displayName || data.userId}</span>
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          С
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          По
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>
      {loading && !data?.items?.length ? (
        <div className="py-8 text-center text-sm text-[var(--portal-text-muted)]">Загрузка...</div>
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
              <TableHead>Браузер</TableHead>
              <TableHead>ОС</TableHead>
              <TableHead>Устройство</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => {
              const env = parseUserAgent(row.userAgent);
              return (
                <TableRow key={row.id}>
                  <TableCell>{safeFormat(row.loginAt)}</TableCell>
                  <TableCell>{safeFormat(row.lastActivityAt)}</TableCell>
                  <TableCell>{row.logoutAt ? safeFormat(row.logoutAt) : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.ipAddress ?? '—'}</TableCell>
                  <TableCell className="text-sm" title={row.userAgent ?? undefined}>
                    {env.browser}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--portal-text-muted)]">{env.os}</TableCell>
                  <TableCell className="text-sm text-[var(--portal-text-muted)]">{env.device}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
