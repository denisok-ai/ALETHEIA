'use client';

/**
 * Admin: список IMAP-ящиков и ручная синхронизация.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader2, RefreshCw } from 'lucide-react';

export type InmailMailboxRow = {
  id: string;
  label: string;
  username: string;
  imapHost: string;
  imapPort: number;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
};

export function InmailAdminClient({ initialRows }: { initialRows: InmailMailboxRow[] }) {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function syncOne(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/portal/admin/inbound-mailboxes/${id}/sync`, { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; imported?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Ошибка синхронизации');
        return;
      }
      toast.success(`Импортировано писем: ${data.imported ?? 0}`);
      window.location.reload();
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {initialRows.length === 0 ? (
        <EmptyState
          title="Нет подключённых ящиков"
          description="Создайте ящик в разделе «Ящики домена» или добавьте внешний IMAP позже."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--portal-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Метка</TableHead>
                <TableHead>Учётная запись</TableHead>
                <TableHead>IMAP</TableHead>
                <TableHead>Синхронизация</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-sm">{row.username}</TableCell>
                  <TableCell className="text-sm text-[var(--portal-muted)]">
                    {row.imapHost}:{row.imapPort}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{row.lastSyncStatus ?? '—'}</div>
                    {row.lastSyncError ? (
                      <div className="text-xs text-red-400">{row.lastSyncError}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!row.enabled || syncingId === row.id}
                      onClick={() => syncOne(row.id)}
                    >
                      {syncingId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="mr-1 h-4 w-4" />
                          Синхронизировать
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
