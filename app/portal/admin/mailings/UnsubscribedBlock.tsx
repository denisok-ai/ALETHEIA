'use client';

/**
 * Блок «Отписавшиеся от рассылок»: таблица и экспорт CSV.
 */
import { useState, useEffect } from 'react';
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
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Download, UserMinus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface UnsubRow {
  id: string;
  email: string;
  createdAt: string;
}

export function UnsubscribedBlock() {
  const [list, setList] = useState<UnsubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<UnsubRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/portal/admin/mailings/unsubscribed');
      if (r.ok) {
        const d = await r.json();
        setList(d.list ?? []);
      }
    } catch {
      toast.error('Не удалось загрузить список');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/portal/admin/mailings/unsubscribed?format=csv');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unsubscribed-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Экспорт выполнен');
    } catch {
      toast.error('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }

  async function handleRemove(row: UnsubRow) {
    if (!row) return;
    setRemovingId(row.id);
    try {
      const r = await fetch(`/api/portal/admin/mailings/unsubscribed/${row.id}`, { method: 'DELETE' });
      if (r.ok) {
        setList((prev) => prev.filter((x) => x.id !== row.id));
        setConfirmRemove(null);
        toast.success('Адрес удалён из списка отписавшихся');
      } else {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error ?? 'Ошибка удаления');
      }
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <Card
        title="Отписавшиеся от рассылок"
        description="Эти адреса не получают рассылки. При отправке они исключаются из списка получателей. Удаление из списка разрешает снова присылать рассылки на этот email."
      >
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={exporting || loading || list.length === 0}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Экспорт CSV
            </Button>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">Загрузка…</p>
          ) : list.length === 0 ? (
            <EmptyState
              title="Нет отписавшихся"
              description="Когда пользователи отпишутся через страницу /unsubscribe, они появятся здесь."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="whitespace-nowrap">Дата отписки</TableHead>
                    <TableHead className="w-32 text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-text-muted">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell className="text-text-muted">
                        {format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-muted hover:text-dark"
                          disabled={removingId !== null}
                          onClick={() => setConfirmRemove(row)}
                          aria-label={`Удалить ${row.email} из списка отписавшихся`}
                        >
                          {removingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
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
      </Card>
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title="Разрешить снова получать рассылки?"
        description={
          confirmRemove
            ? `Адрес ${confirmRemove.email} будет удалён из списка отписавшихся и снова сможет получать рассылки.`
            : ''
        }
        confirmLabel="Удалить из списка"
        variant="primary"
        onConfirm={async () => {
          if (confirmRemove) await handleRemove(confirmRemove);
        }}
      />
    </>
  );
}
