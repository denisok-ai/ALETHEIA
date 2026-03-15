'use client';

/**
 * Пагинация таблицы: размер страницы, записей X–Y из Z, навигация, настройка колонок (шестерёнка), экспорт в Excel (XLSX).
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Единые размеры страницы для всех таблиц портала (как на /portal/admin/media). */
export const STANDARD_PAGE_SIZES = [10, 25, 50, 100];

const DEFAULT_PAGE_SIZES = STANDARD_PAGE_SIZES;

export interface ColumnConfigItem {
  id: string;
  label: string;
}

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Кнопка «Выгрузить в Excel» (XLSX). Если не передано — кнопка не показывается. */
  onExportExcel?: () => void;
  /** Подпись кнопки экспорта */
  exportLabel?: string;
  /** Список колонок для настройки видимости. Если передан — показывается кнопка «Настройка». */
  columnConfig?: ColumnConfigItem[];
  /** Id колонок, которые отображаются в таблице. */
  visibleColumnIds?: string[];
  /** Вызов при изменении набора видимых колонок. */
  onVisibleColumnIdsChange?: (ids: string[]) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  onExportExcel,
  exportLabel = 'Excel',
  columnConfig,
  visibleColumnIds = [],
  onVisibleColumnIdsChange,
}: TablePaginationProps) {
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const start = total === 0 ? 0 : currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, total);

  const visibleSet = new Set(visibleColumnIds);
  const handleToggleColumn = (id: string) => {
    if (!onVisibleColumnIdsChange || !columnConfig) return;
    const next = visibleSet.has(id)
      ? visibleColumnIds.filter((x) => x !== id)
      : [...visibleColumnIds, id];
    if (next.length === 0) return;
    onVisibleColumnIdsChange(next);
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {onPageSizeChange && (
            <>
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { onPageSizeChange(size); onPageChange(0); }}
                  className={`rounded px-2 py-1 text-sm ${pageSize === size ? 'bg-[#EEF2FF] text-[#4F46E5] font-medium' : 'text-[var(--portal-text-muted)] hover:bg-[#F1F5F9]'}`}
                  aria-label={`Показать по ${size}`}
                  aria-pressed={pageSize === size}
                >
                  +{size}
                </button>
              ))}
              <span className="ml-2 text-sm text-[var(--portal-text-muted)]">
                {total === 0 ? 'Нет записей' : `Записи ${start}–${end} из ${total}`}
              </span>
            </>
          )}
          {!onPageSizeChange && (
            <span className="text-sm text-[var(--portal-text-muted)]">
              {total === 0 ? 'Нет записей' : `Записи ${start}–${end} из ${total}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {columnConfig && columnConfig.length > 0 && (
            <button
              type="button"
              onClick={() => setColumnSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-white p-1.5 text-[var(--portal-text)] hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
              aria-label="Настройка колонок"
              title="Настройка колонок"
            >
              <Settings className="h-4 w-4 text-[var(--portal-text-muted)]" />
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-sm text-[var(--portal-text)] hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
              aria-label={`Выгрузить в ${exportLabel}`}
              title={`Выгрузить в ${exportLabel}`}
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              {exportLabel}
            </button>
          )}
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(0)}
            disabled={currentPage === 0 || totalPages <= 1}
            className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[var(--portal-text)] disabled:opacity-50 hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
            aria-label="В начало"
            title="В начало"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[var(--portal-text)] disabled:opacity-50 hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
            aria-label="Предыдущая страница"
            title="Предыдущая"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7rem] px-2 text-center text-sm text-[var(--portal-text-muted)]">
            {totalPages === 0 ? 'Нет записей' : `Страница ${currentPage + 1} из ${totalPages}`}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
            className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[var(--portal-text)] disabled:opacity-50 hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
            aria-label="Следующая страница"
            title="Следующая"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={currentPage >= totalPages - 1 || totalPages <= 1}
            className="rounded border border-[#E2E8F0] bg-white p-1.5 text-[var(--portal-text)] disabled:opacity-50 hover:bg-[#F8FAFC] focus:ring-2 focus:ring-[#6366F1]"
            aria-label="В конец"
            title="В конец"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

      {columnConfig && columnConfig.length > 0 && (
        <Dialog open={columnSettingsOpen} onOpenChange={setColumnSettingsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Колонки таблицы</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[var(--portal-text-muted)] mb-3">
              Выберите поля для отображения в таблице
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {columnConfig.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-[#F8FAFC]"
                >
                  <input
                    type="checkbox"
                    checked={visibleSet.has(col.id)}
                    onChange={() => handleToggleColumn(col.id)}
                    className="rounded border-[#E2E8F0] text-[#6366F1] focus:ring-[#6366F1]"
                  />
                  <span className="text-sm text-[var(--portal-text)]">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setColumnSettingsOpen(false)}>
                Готово
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
