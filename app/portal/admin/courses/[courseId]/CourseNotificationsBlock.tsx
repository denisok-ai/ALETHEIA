'use client';

/**
 * Admin: вкладка «Уведомления» — просмотр и редактирование списка наборов уведомлений,
 * прикреплённых к мероприятию; добавление из каталога, исключение.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronDown, Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getNotificationSetEventLabel } from '@/lib/notification-set-events';

type AttachedSet = {
  id: string;
  notificationSetId: string;
  eventType: string;
  name: string;
};

type CatalogSet = {
  id: string;
  eventType: string;
  name: string;
  isDefault: boolean;
};

const PAGE_SIZES = [5, 10, 50] as const;

export function CourseNotificationsBlock({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [sets, setSets] = useState<AttachedSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'one' | 'several'>('one');
  const [catalog, setCatalog] = useState<CatalogSet[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<AttachedSet | null>(null);
  const [excluding, setExcluding] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/notifications`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { sets: AttachedSet[] };
      setSets(data.sets ?? []);
    } catch {
      toast.error('Ошибка загрузки');
      setSets([]);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!addDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (addRef.current?.contains(e.target as Node)) return;
      setAddDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [addDropdownOpen]);

  const openAddCatalog = (mode: 'one' | 'several') => {
    setAddDropdownOpen(false);
    setAddMode(mode);
    setSelectedCatalogIds(new Set());
    setAddOpen(true);
    setCatalogLoading(true);
    fetch('/api/portal/admin/notification-sets')
      .then((r) => r.json())
      .then((data: { notificationSets: CatalogSet[] }) => {
        setCatalog(data.notificationSets ?? []);
      })
      .catch(() => {
        toast.error('Ошибка загрузки каталога');
        setCatalog([]);
      })
      .finally(() => setCatalogLoading(false));
  };

  const filtered = sets.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      getNotificationSetEventLabel(s.eventType).toLowerCase().includes(q)
    );
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const handleAddSets = async () => {
    const ids = Array.from(selectedCatalogIds);
    if (ids.length === 0) {
      toast.error('Выберите хотя бы один набор');
      return;
    }
    if (addMode === 'one' && ids.length > 1) {
      toast.error('Выберите один набор');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationSetIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка при добавлении');
        return;
      }
      toast.success(`Добавлено наборов: ${data.attached ?? 0}`);
      setAddOpen(false);
      fetchData();
    } catch {
      toast.error('Ошибка при добавлении');
    } finally {
      setAdding(false);
    }
  };

  const handleExclude = async () => {
    const target = excludeTarget;
    setExcludeTarget(null);
    if (!target) return;
    setExcluding(true);
    try {
      const res = await fetch(
        `/api/portal/admin/courses/${courseId}/notifications/${target.notificationSetId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Ошибка при исключении');
        return;
      }
      toast.success('Набор исключён из мероприятия');
      fetchData();
    } catch {
      toast.error('Ошибка при исключении');
    } finally {
      setExcluding(false);
    }
  };

  const toggleCatalogSelection = (id: string) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (addMode === 'one') return new Set([id]);
      }
      return next;
    });
  };

  const attachedSetIds = new Set(sets.map((s) => s.notificationSetId));
  const catalogAvailable = catalog.filter((c) => !attachedSetIds.has(c.id));

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-dark">Уведомления</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={addRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setAddDropdownOpen((v) => !v);
              }}
              className="gap-1"
            >
              Добавить набор уведомлений
              <ChevronDown className="h-4 w-4" />
            </Button>
            {addDropdownOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[200px] rounded-lg border border-border bg-white py-1 shadow-lg">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-bg-cream"
                onClick={() => openAddCatalog('one')}
              >
                Выбрать один
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-bg-cream"
                onClick={() => openAddCatalog('several')}
              >
                Выбрать несколько
              </button>
            </div>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              placeholder="Найти в списке"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-border bg-white py-2 pl-8 pr-3 text-sm text-dark placeholder:text-text-muted"
              aria-label="Найти в списке"
            />
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-text-muted">
        Наборы уведомлений, которые будут автоматически отправляться пользователям по данному мероприятию.{' '}
        <Link href="/portal/admin/notification-sets" className="text-primary hover:underline">
          Каталог наборов →
        </Link>
      </p>

      {loading ? (
        <TableSkeleton rows={5} cols={4} className="mt-4" />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Нет наборов уведомлений"
          description="Добавьте набор из каталога через кнопку «Добавить набор уведомлений» выше."
          icon={<Bell className="h-10 w-10" />}
          action={
            <Link href="/portal/admin/notification-sets">
              <Button variant="secondary" size="sm">Открыть каталог наборов</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">№</TableHead>
                  <TableHead>Тип события</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="w-32">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-text-muted">{start + idx + 1}</TableCell>
                    <TableCell>{getNotificationSetEventLabel(row.eventType)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/portal/admin/notification-sets/${row.notificationSetId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/portal/admin/notification-sets/${row.notificationSetId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Подробнее
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExcludeTarget(row)}
                          disabled={excluding}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        >
                          Исключить
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setPage(0);
                  }}
                  className={`rounded px-2 py-1 text-sm ${pageSize === size ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-cream'}`}
                >
                  +{size}
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">
                Записи {total === 0 ? '0' : start + 1}–{Math.min(start + pageSize, total)} из {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Предыдущая страница"
              >
                ←
              </button>
              <span className="text-sm text-text-muted">
                Страница {currentPage + 1} из {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Следующая страница"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addMode === 'one' ? 'Выбрать один набор уведомлений' : 'Выбрать наборы уведомлений'}
            </DialogTitle>
          </DialogHeader>
          {catalogLoading ? (
            <p className="py-4 text-sm text-text-muted">Загрузка каталога…</p>
          ) : catalogAvailable.length === 0 ? (
            <p className="py-4 text-sm text-text-muted">
              Все наборы из каталога уже прикреплены к мероприятию.
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {catalogAvailable.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 hover:bg-bg-cream"
                >
                  <input
                    type="checkbox"
                    checked={selectedCatalogIds.has(s.id)}
                    onChange={() => toggleCatalogSelection(s.id)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-text-muted">
                    ({getNotificationSetEventLabel(s.eventType)})
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleAddSets}
              disabled={adding || selectedCatalogIds.size === 0 || catalogLoading}
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!excludeTarget}
        onOpenChange={(open) => !open && setExcludeTarget(null)}
        onConfirm={handleExclude}
        title="Исключить набор уведомлений"
        description={
          excludeTarget
            ? `Исключить набор «${excludeTarget.name}» из списка уведомлений данного мероприятия?`
            : ''
        }
        confirmLabel="Исключить"
        variant="danger"
      />
    </div>
  );
}
