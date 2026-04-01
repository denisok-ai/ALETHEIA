'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pencil, Trash2, ExternalLink, Image as ImageIcon, Search, FolderOpen, CheckSquare, Square, FolderPlus, FolderMinus, Upload, Sparkles } from 'lucide-react';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsx } from '@/lib/export-xlsx';
import { isPlaceholderOrExampleUrl } from '@/lib/placeholder-url';
import { MediaItemGroupsBlock } from './MediaItemGroupsBlock';
import { GroupPickerModal } from '@/components/portal/GroupPickerModal';
import MediaViewerLazy from '@/components/portal/media/MediaViewerLazy';
import { MediaCoverPlaceholder } from '@/components/portal/CourseCoverPlaceholder';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
  thumbnail_url?: string | null;
  mime_type: string | null;
  category: string | null;
  description?: string | null;
  type?: string;
  views_count?: number;
  allow_download?: boolean;
  rating_sum?: number;
  rating_count?: number;
  created_at: string;
  course_id?: string | null;
  course_title?: string | null;
}

const RESOURCE_TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'file', label: 'Файл' },
  { value: 'link', label: 'Ссылка' },
];

const CATEGORY_SUGGESTIONS = ['video', 'pdf', 'image'];

const MEDIA_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'num', label: '№' },
  { id: 'title', label: 'Название' },
  { id: 'description', label: 'Описание' },
  { id: 'category', label: 'Категория' },
  { id: 'type', label: 'Тип' },
  { id: 'mime', label: 'MIME' },
  { id: 'views', label: 'Просмотры' },
  { id: 'rating', label: 'Рейтинг' },
  { id: 'download', label: 'Скачивание' },
  { id: 'usage', label: 'Использование' },
];

interface MediaAdminClientProps {
  initialItems: MediaItem[];
  selectedGroupId?: string | null;
  onGroupsChanged?: () => void;
}

export function MediaAdminClient({ initialItems, selectedGroupId = null, onGroupsChanged }: MediaAdminClientProps) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkCategory, setLinkCategory] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkAllowDownload, setLinkAllowDownload] = useState(true);
  const [addingLink, setAddingLink] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => MEDIA_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'table';
    try {
      const v = localStorage.getItem('portal-media-admin-view');
      if (v === 'grid' || v === 'table') return v;
    } catch {
      /* ignore */
    }
    return window.matchMedia('(min-width: 1280px)').matches ? 'table' : 'grid';
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const sync = () => {
      try {
        if (localStorage.getItem('portal-media-admin-view')) return;
      } catch {
        /* ignore */
      }
      setViewMode(mq.matches ? 'table' : 'grid');
    };
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const persistViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode);
    try {
      localStorage.setItem('portal-media-admin-view', mode);
    } catch {
      /* ignore */
    }
  };
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 20,
    disabled: uploading,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm', '.avi', '.mov', '.wmv'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/html': ['.htm', '.html'],
    },
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('Выберите хотя бы один файл');
      return;
    }
    setUploading(true);
    setError(null);
    let uploaded = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', files.length === 1 && title.trim() ? title.trim() : file.name.replace(/\.[^/.]+$/, '') || file.name);
        if (category.trim()) fd.append('category', category.trim());
        if (description.trim()) fd.append('description', description.trim());
        fd.append('allowDownload', allowDownload ? 'true' : 'false');
        const res = await fetch('/api/portal/admin/media/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки');
        if (data.media) {
          setItems((prev) => [{ ...data.media, course_id: null, course_title: null }, ...prev]);
          uploaded++;
        }
      }
      setTitle('');
      setCategory('');
      setDescription('');
      setAllowDownload(true);
      setFiles([]);
      setUploadModalOpen(false);
      toast.success(uploaded === 1 ? 'Файл загружен' : `Загружено файлов: ${uploaded}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setUploading(false);
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim() || !linkTitle.trim()) {
      toast.error('Укажите URL и название');
      return;
    }
    setAddingLink(true);
    try {
      const res = await fetch('/api/portal/admin/media/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: linkUrl.trim(),
          title: linkTitle.trim(),
          category: linkCategory.trim() || null,
          description: linkDescription.trim() || null,
          allowDownload: linkAllowDownload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.issues?.[0]?.message ?? 'Ошибка');
      if (data.media) {
        setItems((prev) => [{ ...data.media, course_id: null, course_title: null }, ...prev]);
        setAddLinkOpen(false);
        setLinkUrl('');
        setLinkTitle('');
        setLinkCategory('');
        setLinkDescription('');
        setLinkAllowDownload(true);
        toast.success('Ссылка добавлена');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAddingLink(false);
  }

  async function handleUpdate(id: string, data: { title: string; category: string | null; description?: string | null; allow_download?: boolean; thumbnail_url?: string | null }) {
    const r = await fetch(`/api/portal/admin/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        category: data.category,
        description: data.description,
        allowDownload: data.allow_download,
        thumbnailUrl: data.thumbnail_url,
      }),
    });
    if (!r.ok) throw new Error('Ошибка');
    const json = await r.json();
    setItems((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              title: json.media.title,
              category: json.media.category,
              description: json.media.description,
              allow_download: json.media.allowDownload,
              thumbnail_url: json.media.thumbnailUrl ?? null,
            }
          : m
      )
    );
    setEditing(null);
    toast.success('Обновлено');
  }

  async function handleDelete(m: MediaItem) {
    setDeleteTarget(null);
    const r = await fetch(`/api/portal/admin/media/${m.id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Ошибка');
    setItems((prev) => prev.filter((x) => x.id !== m.id));
    toast.success('Удалено');
  }

  const categories = Array.from(new Set(items.map((m) => m.category).filter(Boolean) as string[])).sort();
  let filteredItems = items;
  if (resourceTypeFilter !== 'all') {
    filteredItems = filteredItems.filter((m) => (m.type ?? 'file') === resourceTypeFilter);
  }
  if (categoryFilter !== 'all') {
    filteredItems = filteredItems.filter((m) => m.category === categoryFilter);
  }
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filteredItems = filteredItems.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.category ?? '').toLowerCase().includes(q)
    );
  }
  const mediaSortGetters: Record<string, (m: MediaItem) => unknown> = {
    title: (m) => m.title,
    description: (m) => m.description ?? '',
    category: (m) => m.category ?? '',
    type: (m) => m.type ?? 'file',
    mime: (m) => m.mime_type ?? '',
    views: (m) => m.views_count ?? 0,
    rating: (m) => (m.rating_count ?? 0) > 0 ? (m.rating_sum ?? 0) / (m.rating_count ?? 1) : 0,
    download: (m) => (m.allow_download ?? true) ? 1 : 0,
    usage: (m) => m.course_title ?? '',
  };
  const sortedItems = sortKey && mediaSortGetters[sortKey]
    ? sortTableBy(filteredItems, mediaSortGetters[sortKey], sortDir)
    : filteredItems;
  const total = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageItems = sortedItems.slice(start, start + pageSize);

  const handleExportExcel = () => {
    downloadXlsx(sortedItems, [
      { key: 'title', header: 'Название' },
      { key: 'description', header: 'Описание' },
      { key: 'category', header: 'Категория' },
      { key: 'type', header: 'Тип' },
      { key: 'mime_type', header: 'MIME' },
      { key: 'views_count', header: 'Просмотры' },
      { key: 'course_title', header: 'Курс' },
      { key: 'created_at', header: 'Создан' },
    ], `media-${new Date().toISOString().slice(0, 10)}`);
  };

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const pageIds = pageItems.map((m) => m.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleBulkAddToGroup(groupId: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setGroupActionLoading(true);
    let ok = 0;
    for (const mediaId of ids) {
      try {
        const r = await fetch(`/api/portal/admin/groups/${groupId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId }),
        });
        if (r.ok) ok++;
      } catch (_) {}
    }
    setGroupActionLoading(false);
    setGroupPickerOpen(false);
    setSelectedIds(new Set());
    onGroupsChanged?.();
    toast.success(ok === ids.length ? `Добавлено в группу: ${ok} ресурсов` : `Добавлено ${ok} из ${ids.length}`);
  }

  async function handleBulkRemoveFromGroup() {
    if (!selectedGroupId) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setGroupActionLoading(true);
    let ok = 0;
    for (const mediaId of ids) {
      try {
        const r = await fetch(`/api/portal/admin/media/${mediaId}/groups?groupId=${selectedGroupId}`, { method: 'DELETE' });
        if (r.ok) ok++;
      } catch (_) {}
    }
    setGroupActionLoading(false);
    setSelectedIds(new Set());
    onGroupsChanged?.();
    toast.success(ok === ids.length ? `Исключено из группы: ${ok} ресурсов` : `Исключено ${ok} из ${ids.length}`);
  }

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setFiles([]);
    setTitle('');
    setCategory('');
    setDescription('');
    setError(null);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Загрузить файл
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setAddLinkOpen(true)}>
          Добавить ссылку
        </Button>
      </div>

      <Dialog open={uploadModalOpen} onOpenChange={(open) => !open && closeUploadModal()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Загрузить файл</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-2">
            <div
              {...getRootProps()}
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                isDragActive ? 'border-[#6366F1] bg-[#EEF2FF]' : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#6366F1]/50'
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm text-[var(--portal-text-muted)]">
                {isDragActive ? 'Отпустите файлы…' : 'Перетащите файлы сюда или нажмите для выбора (несколько файлов)'}
              </p>
              {files.length > 0 && <p className="mt-2 text-sm font-medium text-[#6366F1]">Выбрано: {files.length}</p>}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="media-title">Название</Label>
                  <Input
                    id="media-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Пусто — подставится имя файла"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="media-category">Категория</Label>
                  <select
                    id="media-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="media-description">Описание (необязательно)</Label>
                <textarea
                  id="media-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
                  placeholder="Краткое описание ресурса"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="rounded border-[#E2E8F0]"
                  />
                  Разрешить скачивание
                </label>
                <Button type="submit" disabled={uploading || files.length === 0}>
                  {uploading ? 'Загрузка…' : files.length > 0 ? `Загрузить (${files.length})` : 'Загрузить'}
                </Button>
              </div>
            </div>
            {files.length > 0 && <p className="text-sm text-[var(--portal-text-muted)]">Файлов: {files.length}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[var(--portal-text)]">Тип:</label>
          <select
            value={resourceTypeFilter}
            onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            {RESOURCE_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <label className="text-sm font-medium text-[var(--portal-text)]">Категория:</label>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            <option value="all">Все</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
            <input
              type="search"
              placeholder="Название, описание, категория"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-56 sm:w-64 rounded-lg border border-[#E2E8F0] bg-white py-2 pl-8 pr-3 text-sm text-[var(--portal-text)] placeholder:text-[var(--portal-text-muted)]"
              aria-label="Поиск по названию, описанию и категории"
            />
          </div>
          <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-sm">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 ${viewMode === 'table' ? 'bg-[#EEF2FF] text-[#4338CA] font-medium' : 'text-[var(--portal-text-muted)]'}`}
              onClick={() => { persistViewMode('table'); setPage(0); }}
            >
              Таблица
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 ${viewMode === 'grid' ? 'bg-[#EEF2FF] text-[#4338CA] font-medium' : 'text-[var(--portal-text-muted)]'}`}
              onClick={() => { persistViewMode('grid'); setPage(0); }}
            >
              Сетка
            </button>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
            <span className="text-sm font-medium text-[var(--portal-text)]">Выбрано: {selectedIds.size}</span>
            <Button size="sm" variant="secondary" disabled={groupActionLoading} onClick={() => setGroupPickerOpen(true)}>
              <FolderPlus className="h-3.5 w-3.5 mr-1" />
              Добавить в группу
            </Button>
            {selectedGroupId && (
              <Button size="sm" variant="secondary" disabled={groupActionLoading} onClick={() => handleBulkRemoveFromGroup()}>
                <FolderMinus className="h-3.5 w-3.5 mr-1" />
                Исключить из группы
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Снять выбор
            </Button>
          </div>
        )}
        {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelectAllOnPage(); }}
                    className="p-1"
                    title={pageItems.every((m) => selectedIds.has(m.id)) ? 'Снять выбор' : 'Выбрать страницу'}
                  >
                    {pageItems.length > 0 && pageItems.every((m) => selectedIds.has(m.id)) ? (
                      <CheckSquare className="h-4 w-4 text-[#6366F1]" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[76px] min-w-[76px]">Превью</TableHead>
                {visibleColumnIds.includes('num') && <TableHead className="w-10">№</TableHead>}
                {visibleColumnIds.includes('title') && (
                  <SortableTableHead sortKey="title" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                    Название
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('description') && (
                  <SortableTableHead sortKey="description" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="max-w-[200px]">
                    Описание
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('category') && (
                  <SortableTableHead sortKey="category" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                    Категория
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('type') && (
                  <SortableTableHead sortKey="type" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                    Тип
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('mime') && (
                  <SortableTableHead sortKey="mime" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                    MIME
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('views') && (
                  <SortableTableHead sortKey="views" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="w-20">
                    Просмотры
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('rating') && (
                  <SortableTableHead sortKey="rating" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="w-20">
                    Рейтинг
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('download') && (
                  <SortableTableHead sortKey="download" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="w-24">
                    Скачивание
                  </SortableTableHead>
                )}
                {visibleColumnIds.includes('usage') && (
                  <SortableTableHead sortKey="usage" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                    Использование
                  </SortableTableHead>
                )}
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + visibleColumnIds.length} className="p-0">
                    <EmptyState
                      title="Нет файлов"
                      description="Нажмите «Загрузить файл» или измените фильтры"
                      icon={<FolderOpen className="h-10 w-10" />}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((m, idx) => {
                  const resType = m.type ?? 'file';
                  const rating = (m.rating_count ?? 0) > 0
                    ? ((m.rating_sum ?? 0) / (m.rating_count ?? 1)).toFixed(1)
                    : '—';
                  return (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer hover:bg-[#F8FAFC]"
                    onClick={() => setPreviewItem(m)}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleSelect(m.id)} className="p-1 min-h-9 min-w-9 inline-flex items-center justify-center">
                        {selectedIds.has(m.id) ? <CheckSquare className="h-4 w-4 text-[#6366F1]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
                      </button>
                    </TableCell>
                    <TableCell className="w-[76px] p-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="relative block h-14 w-[4.5rem] rounded overflow-hidden bg-[#1e1340] shrink-0 ring-1 ring-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                        onClick={() => setPreviewItem(m)}
                        aria-label={`Превью: ${m.title}`}
                      >
                        {m.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin media thumbnails
                          <img src={m.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <MediaCoverPlaceholder category={m.category} title={m.title} className="absolute inset-0 h-full w-full" />
                        )}
                      </button>
                    </TableCell>
                    {visibleColumnIds.includes('num') && <TableCell className="text-[var(--portal-text-muted)]">{start + idx + 1}</TableCell>}
                    {visibleColumnIds.includes('title') && <TableCell className="font-medium text-[var(--portal-text)]">{m.title}</TableCell>}
                    {visibleColumnIds.includes('description') && (
                      <TableCell className="text-[var(--portal-text-muted)] text-sm max-w-[220px]">
                        <span className="line-clamp-2" title={m.description ?? undefined}>{m.description?.trim() ? m.description : '—'}</span>
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('category') && <TableCell className="text-[var(--portal-text-muted)]">{m.category ?? '—'}</TableCell>}
                    {visibleColumnIds.includes('type') && <TableCell className="text-[var(--portal-text-muted)]">{resType === 'link' ? 'Ссылка' : 'Файл'}</TableCell>}
                    {visibleColumnIds.includes('mime') && <TableCell className="text-[var(--portal-text-muted)] text-xs max-w-[100px] truncate" title={m.mime_type ?? ''}>{m.mime_type ?? '—'}</TableCell>}
                    {visibleColumnIds.includes('views') && <TableCell className="text-[var(--portal-text-muted)]">{m.views_count ?? 0}</TableCell>}
                    {visibleColumnIds.includes('rating') && <TableCell className="text-[var(--portal-text-muted)]">{rating}</TableCell>}
                    {visibleColumnIds.includes('download') && <TableCell className="text-[var(--portal-text-muted)]">{(m.allow_download ?? true) ? 'Да' : 'Нет'}</TableCell>}
                    {visibleColumnIds.includes('usage') && (
                      <TableCell className="text-[var(--portal-text-muted)] text-sm" onClick={(e) => e.stopPropagation()}>
                        {m.course_title ? (
                          <a href={`/portal/admin/courses/${m.course_id}`} className="text-[#6366F1] hover:underline">{m.course_title}</a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-h-9 min-w-9 p-0 shrink-0"
                          onClick={() => setPreviewItem(m)}
                          aria-label="Превью"
                        >
                          <ImageIcon className="h-[18px] w-[18px]" />
                        </Button>
                        {isPlaceholderOrExampleUrl(m.file_url) ? (
                          <span
                            className="inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded text-[var(--portal-text-muted)]"
                            title="Тестовая ссылка"
                            aria-label="Ссылка (тест)"
                          >
                            <ExternalLink className="h-[18px] w-[18px]" />
                          </span>
                        ) : (
                          <a
                            href={m.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-[#6366F1]"
                            aria-label="Открыть"
                          >
                            <ExternalLink className="h-[18px] w-[18px]" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-h-9 min-w-9 p-0 shrink-0"
                          onClick={() => setEditing(m)}
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-[18px] w-[18px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 min-h-9 min-w-9 p-0 shrink-0 text-red-600"
                          onClick={() => setDeleteTarget(m)}
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
                })
              )}
            </TableBody>
          </Table>
        </div>
        )}

        {viewMode === 'grid' && (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            {pageItems.length === 0 ? (
              <EmptyState
                title="Нет файлов"
                description="Нажмите «Загрузить файл» или измените фильтры"
                icon={<FolderOpen className="h-10 w-10" />}
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((m) => {
                  const resType = m.type ?? 'file';
                  return (
                    <li key={m.id} className="flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FAFBFC] shadow-sm">
                      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#1e1340]">
                        {m.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin media thumbnails
                          <img src={m.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <MediaCoverPlaceholder category={m.category} title={m.title} className="absolute inset-0 h-full w-full" />
                        )}
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                          <span className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">{resType === 'link' ? 'Ссылка' : 'Файл'}</span>
                          {m.category && (
                            <span className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{m.category}</span>
                          )}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 pointer-events-none">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="pointer-events-auto min-h-9 shadow-md opacity-95"
                            onClick={() => setPreviewItem(m)}
                          >
                            Открыть
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div className="flex items-start gap-2">
                          <button type="button" onClick={() => toggleSelect(m.id)} className="mt-0.5 p-0.5 shrink-0" aria-label={selectedIds.has(m.id) ? 'Снять выбор' : 'Выбрать'}>
                            {selectedIds.has(m.id) ? <CheckSquare className="h-4 w-4 text-[#6366F1]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-[var(--portal-text)] leading-snug line-clamp-2">{m.title}</p>
                            {m.description?.trim() ? (
                              <p className="mt-1 text-xs text-[var(--portal-text-muted)] line-clamp-2 leading-relaxed" title={m.description}>
                                {m.description}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-[var(--portal-text-soft)] truncate" title={m.mime_type ?? ''}>{m.mime_type ?? '—'}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 border-t border-[#E2E8F0] pt-2">
                          <Button variant="ghost" size="sm" className="h-9 min-h-9 px-2" onClick={() => setPreviewItem(m)} aria-label="Превью">
                            <ImageIcon className="h-[18px] w-[18px]" />
                          </Button>
                          {isPlaceholderOrExampleUrl(m.file_url) ? (
                            <span className="inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center text-[var(--portal-text-muted)]" title="Тестовая ссылка">
                              <ExternalLink className="h-[18px] w-[18px]" />
                            </span>
                          ) : (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded text-[var(--portal-text-muted)] hover:text-[#6366F1]"
                              aria-label="Открыть файл"
                            >
                              <ExternalLink className="h-[18px] w-[18px]" />
                            </a>
                          )}
                          <Button variant="ghost" size="sm" className="h-9 min-h-9 px-2" onClick={() => setEditing(m)} aria-label="Редактировать">
                            <Pencil className="h-[18px] w-[18px]" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 min-h-9 px-2 text-red-600" onClick={() => setDeleteTarget(m)} aria-label="Удалить">
                            <Trash2 className="h-[18px] w-[18px]" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {total > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onExportExcel={handleExportExcel}
            exportLabel="Excel"
            columnConfig={viewMode === 'table' ? MEDIA_TABLE_COLUMNS : undefined}
            visibleColumnIds={viewMode === 'table' ? visibleColumnIds : []}
            onVisibleColumnIdsChange={viewMode === 'table' ? setVisibleColumnIds : undefined}
          />
        )}
      </section>

      {editing && (
        <EditMediaDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => handleUpdate(editing.id, data)}
          onThumbnailUploaded={(url) => setItems((prev) => prev.map((m) => (m.id === editing.id ? { ...m, thumbnail_url: url } : m)))}
        />
      )}
      {previewItem && (
        <PreviewDialog
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить ресурс?"
        description={deleteTarget ? `«${deleteTarget.title}» будет удалён.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
      />
      <GroupPickerModal
        open={groupPickerOpen}
        onOpenChange={setGroupPickerOpen}
        moduleType="media"
        onSelect={handleBulkAddToGroup}
        title="Добавить выбранные ресурсы в группу"
        confirmLabel="Добавить"
      />

      <Dialog open={addLinkOpen} onOpenChange={setAddLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить ссылку</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddLink} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="link-url">URL *</Label>
              <Input
                id="link-url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="link-title">Название *</Label>
              <Input
                id="link-title"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Название ресурса"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="link-category">Категория</Label>
              <select
                id="link-category"
                value={linkCategory}
                onChange={(e) => setLinkCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="link-description">Описание</Label>
              <textarea
                id="link-description"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={linkAllowDownload}
                onChange={(e) => setLinkAllowDownload(e.target.checked)}
                className="rounded border-[#E2E8F0]"
              />
              Разрешить скачивание / открытие в новой вкладке
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={addingLink}>
                {addingLink ? 'Добавление…' : 'Добавить ссылку'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAddLinkOpen(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewDialog({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-2 overflow-hidden p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <MediaViewerLazy
            title={item.title}
            src={item.file_url}
            mimeType={item.mime_type ?? ''}
            poster={item.thumbnail_url ?? null}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditMediaDialog({
  item,
  onClose,
  onSave,
  onThumbnailUploaded,
}: {
  item: MediaItem;
  onClose: () => void;
  onSave: (data: { title: string; category: string | null; description?: string | null; allow_download?: boolean; thumbnail_url?: string | null }) => void;
  onThumbnailUploaded?: (url: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [allowDownload, setAllowDownload] = useState(item.allow_download !== false);
  const [aiLoading, setAiLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState(item.thumbnail_url ?? '');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingThumbnail(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/portal/admin/media/${item.id}/thumbnail`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки');
      if (data.thumbnailUrl) {
        setThumbnailUrl(data.thumbnailUrl);
        onThumbnailUploaded?.(data.thumbnailUrl);
        toast.success('Обложка загружена');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки обложки');
    }
    setUploadingThumbnail(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="edit-title">Название</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="edit-category">Категория</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const context = `Название: ${title}${item.mime_type ? `\nТип файла: ${item.mime_type}` : ''}`;
                    const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        instruction: 'Ответь в формате JSON: {"category": "одно слово - категория (video/pdf/image/другое)", "description": "краткое описание 1-2 предложения"}. Только JSON, без markdown.',
                        context,
                        maxTokens: 200,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? 'Ошибка');
                    const text = (data.content ?? '').trim();
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      try {
                        const parsed = JSON.parse(jsonMatch[0]) as { category?: string; description?: string };
                        if (parsed.category) setCategory(parsed.category);
                        if (parsed.description) setDescription(parsed.description);
                      } catch {
                        setDescription(text);
                      }
                    } else {
                      setDescription(text);
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Не удалось сгенерировать');
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? 'Генерация…' : 'AI описание и теги'}
              </Button>
            </div>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="video, pdf, image"
              className="mt-1"
              list="edit-category-list"
            />
            <datalist id="edit-category-list">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="edit-description">Описание</Label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="edit-thumbnail">Обложка (превью)</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input
                id="edit-thumbnail"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="/uploads/... или https://..."
                className="flex-1 min-w-0"
              />
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleThumbnailUpload}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingThumbnail}
                onClick={() => thumbnailInputRef.current?.click()}
              >
                {uploadingThumbnail ? 'Загрузка…' : 'Загрузить файл'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-[var(--portal-text-muted)]">URL или загрузите изображение (JPEG, PNG, GIF, WebP до 5 МБ)</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              className="rounded border-[#E2E8F0]"
            />
            Разрешить скачивание
          </label>
          <MediaItemGroupsBlock mediaId={item.id} />
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave({ title, category: category.trim() || null, description: description.trim() || null, allow_download: allowDownload, thumbnail_url: thumbnailUrl.trim() || null })} disabled={!title.trim()}>
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
