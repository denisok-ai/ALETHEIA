'use client';

/**
 * Mailing detail: summary and logs table.
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

interface LogRow {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function MailingDetailClient({
  mailingId,
  status,
  startedAt,
  completedAt,
  sentCount,
  failedCount,
  initialLogs,
}: {
  mailingId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  sentCount: number;
  failedCount: number;
  initialLogs: LogRow[];
}) {
  return (
    <div className="space-y-6">
      <Link href="/portal/admin/mailings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> К списку рассылок
        </Button>
      </Link>

      {(status === 'completed' || status === 'processing') && (
        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="text-lg font-semibold text-dark">Результаты</h2>
          <div className="mt-2 flex flex-wrap gap-6 text-sm">
            {startedAt && (
              <span className="text-text-muted">Начало: {format(new Date(startedAt), 'dd.MM.yyyy HH:mm')}</span>
            )}
            {completedAt && (
              <span className="text-text-muted">Окончание: {format(new Date(completedAt), 'dd.MM.yyyy HH:mm')}</span>
            )}
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" /> Отправлено: {sentCount}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-4 w-4" /> Ошибок: {failedCount}
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Ошибка</TableHead>
              <TableHead>Время</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted py-8">
                  Пока нет записей. Запустите отправку со страницы рассылок.
                </TableCell>
              </TableRow>
            ) : (
              initialLogs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-sm">{l.recipientEmail || '—'}</TableCell>
                  <TableCell className="text-text-muted">{l.recipientName ?? '—'}</TableCell>
                  <TableCell>
                    {l.status === 'sent' ? (
                      <span className="text-green-600">Отправлено</span>
                    ) : (
                      <span className="text-red-600">Ошибка</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                    {l.errorMessage ?? '—'}
                  </TableCell>
                  <TableCell className="text-text-muted text-sm">
                    {l.sentAt ? format(new Date(l.sentAt), 'dd.MM.yy HH:mm') : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
