'use client';

import { useState, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pencil, Trash2, ExternalLink, Image as ImageIcon, Search, FolderOpen, CheckSquare, Square, FolderPlus, FolderMinus } from 'lucide-react';
import { MediaItemGroupsBlock } from './MediaItemGroupsBlock';
import { GroupPickerModal } from '@/components/portal/GroupPickerModal';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
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

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const PDF_MIMES = ['application/pdf'];

const RESOURCE_TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'file', label: 'Файл' },
  { value: 'link', label: 'Ссылка' },
];

const CATEGORY_SUGGESTIONS = ['video', 'pdf', 'image'];

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

  async function handleUpdate(id: string, data: { title: string; category: string | null; description?: string | null; allow_download?: boolean }) {
    const r = await fetch(`/api/portal/admin/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        category: data.category,
        description: data.description,
        allowDownload: data.allow_download,
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
              allow_download: json.media.allow_download,
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
  if (q) filteredItems = filteredItems.filter((m) => m.title.toLowerCase().includes(q));
  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageItems = filteredItems.slice(start, start + pageSize);
  const PAGE_SIZES = [5, 10, 50] as const;

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

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={handleUpload} className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Загрузить файл</h2>
        <div
          {...getRootProps()}
          className={`mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-bg-cream/50 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-text-muted">
            {isDragActive ? 'Отпустите файлы…' : 'Перетащите файлы сюда или нажмите для выбора (несколько файлов)'}
          </p>
          {files.length > 0 && <p className="mt-2 text-sm font-medium text-primary">Выбрано: {files.length}</p>}
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="media-title">Название</Label>
              <Input
                id="media-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Пусто — подставится имя файла"
                className="mt-1"
              />
            </div>
            <div className="min-w-[140px]">
              <Label htmlFor="media-category">Категория</Label>
              <select
                id="media-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
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
              className="mt-1 w-full max-w-xl rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Краткое описание ресурса"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="rounded border-border"
              />
              Разрешить скачивание
            </label>
            <Button type="submit" disabled={uploading || files.length === 0}>
              {uploading ? 'Загрузка…' : files.length > 0 ? `Загрузить (${files.length})` : 'Загрузить'}
            </Button>
          </div>
        </div>
        {files.length > 0 && <p className="mt-2 text-sm text-text-muted">Файлов: {files.length}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setAddLinkOpen(true)}>
          Добавить ссылку
        </Button>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-dark">Тип:</label>
          <select
            value={resourceTypeFilter}
            onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            {RESOURCE_TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <label className="text-sm font-medium text-dark">Категория:</label>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            <option value="all">Все</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              placeholder="Найти в списке"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="w-48 rounded-lg border border-border bg-white py-2 pl-8 pr-3 text-sm text-dark placeholder:text-text-muted"
              aria-label="Найти в списке"
            />
          </div>
        </div>
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium text-dark">Выбрано: {selectedIds.size}</span>
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
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAllOnPage}
                    className="p-1"
                    title={pageItems.every((m) => selectedIds.has(m.id)) ? 'Снять выбор' : 'Выбрать страницу'}
                  >
                    {pageItems.length > 0 && pageItems.every((m) => selectedIds.has(m.id)) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-text-muted" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>MIME</TableHead>
                <TableHead className="w-20">Просмотры</TableHead>
                <TableHead className="w-20">Рейтинг</TableHead>
                <TableHead className="w-24">Скачивание</TableHead>
                <TableHead>Использование</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-0">
                    <EmptyState
                      title="Нет файлов"
                      description="Загрузите файлы через форму выше или измените фильтры"
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
                  <TableRow key={m.id}>
                    <TableCell className="w-10">
                      <button type="button" onClick={() => toggleSelect(m.id)} className="p-1">
                        {selectedIds.has(m.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-text-muted" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-text-muted">{start + idx + 1}</TableCell>
                    <TableCell className="font-medium text-dark">{m.title}</TableCell>
                    <TableCell className="text-text-muted">{m.category ?? '—'}</TableCell>
                    <TableCell className="text-text-muted">{resType === 'link' ? 'Ссылка' : 'Файл'}</TableCell>
                    <TableCell className="text-text-muted text-xs max-w-[100px] truncate" title={m.mime_type ?? ''}>{m.mime_type ?? '—'}</TableCell>
                    <TableCell className="text-text-muted">{m.views_count ?? 0}</TableCell>
                    <TableCell className="text-text-muted">{rating}</TableCell>
                    <TableCell className="text-text-muted">{(m.allow_download ?? true) ? 'Да' : 'Нет'}</TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {m.course_title ? (
                        <a href={`/portal/admin/courses/${m.course_id}`} className="text-primary hover:underline">{m.course_title}</a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPreviewItem(m)}
                          aria-label="Превью"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-primary"
                          aria-label="Открыть"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditing(m)}
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600"
                          onClick={() => setDeleteTarget(m)}
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
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
        {total > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setPage(0); }}
                  className={`rounded px-2 py-1 text-sm ${pageSize === size ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-cream'}`}
                  aria-label={`Показать по ${size}`}
                  aria-pressed={pageSize === size}
                >
                  +{size}
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">
                Записи {start + 1}–{Math.min(start + pageSize, total)} из {total}
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
        )}
      </section>

      {editing && (
        <EditMediaDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => handleUpdate(editing.id, data)}
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
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={linkAllowDownload}
                onChange={(e) => setLinkAllowDownload(e.target.checked)}
                className="rounded border-border"
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
  const mime = item.mime_type ?? '';
  const isImage = IMAGE_MIMES.includes(mime);
  const isVideo = VIDEO_MIMES.some((v) => mime.startsWith('video/')) || mime.startsWith('video/');
  const isAudio = AUDIO_MIMES.some((a) => mime.startsWith('audio/')) || mime.startsWith('audio/');
  const isPdf = PDF_MIMES.includes(mime) || mime.includes('pdf');
  const src = item.file_url;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element -- preview URL dynamic
            <img src={src} alt={item.title} className="max-h-[70vh] w-full object-contain rounded-lg" />
          )}
          {isVideo && !isImage && (
            <video controls className="w-full max-h-[70vh] rounded-lg" src={src}>
              Ваш браузер не поддерживает видео.
            </video>
          )}
          {isAudio && !isVideo && (
            <audio controls className="w-full" src={src}>
              Ваш браузер не поддерживает аудио.
            </audio>
          )}
          {isPdf && !isVideo && !isAudio && (
            <iframe title={item.title} src={src} className="w-full h-[70vh] rounded-lg border border-border" />
          )}
          {!isImage && !isVideo && !isAudio && !isPdf && (
            <div className="space-y-2">
              <p className="text-sm text-text-muted">Предпросмотр недоступен. Доступно только скачивание.</p>
              <a href={src} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-4 w-4" /> Открыть / Скачать
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditMediaDialog({
  item,
  onClose,
  onSave,
}: {
  item: MediaItem;
  onClose: () => void;
  onSave: (data: { title: string; category: string | null; description?: string | null; allow_download?: boolean }) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [allowDownload, setAllowDownload] = useState(item.allow_download !== false);

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
            <Label htmlFor="edit-category">Категория</Label>
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
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              className="rounded border-border"
            />
            Разрешить скачивание
          </label>
          <MediaItemGroupsBlock mediaId={item.id} />
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave({ title, category: category.trim() || null, description: description.trim() || null, allow_download: allowDownload })} disabled={!title.trim()}>
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
