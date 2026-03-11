'use client';

/**
 * Admin: publications table, filters, create/edit form, delete.
 */
import { useState, useMemo } from 'react';
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
import { SearchInput } from '@/components/ui/SearchInput';
import { Plus, Pencil, Trash2, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';

export interface PubRow {
  id: string;
  title: string;
  type: string;
  status: string;
  publishAt: string;
  viewsCount: number;
  ratingSum: number;
  ratingCount: number;
  allowComments?: boolean;
  allowRating?: boolean;
  createdAt: string;
}

export function PublicationsAdminClient({
  initialPublications,
}: {
  initialPublications: PubRow[];
}) {
  const [items, setItems] = useState(initialPublications);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PubRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'news' | 'announcement'>('news');
  const [formStatus, setFormStatus] = useState<'active' | 'closed'>('active');
  const [formPublishAt, setFormPublishAt] = useState('');
  const [formTeaser, setFormTeaser] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formAllowComments, setFormAllowComments] = useState(true);
  const [formAllowRating, setFormAllowRating] = useState(true);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter((p) => p.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, typeFilter, search]);

  async function loadList() {
    const r = await fetch('/api/portal/admin/publications');
    if (r.ok) {
      const d = await r.json();
      setItems(d.publications ?? []);
    }
  }

  function openCreate() {
    setEditingId(null);
    setFormTitle('');
    setFormType('news');
    setFormStatus('active');
    setFormPublishAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setFormTeaser('');
    setFormContent('');
    setFormKeywords('');
    setFormAllowComments(true);
    setFormAllowRating(true);
    setFormOpen(true);
  }

  function openEdit(p: PubRow) {
    setEditingId(p.id);
    setFormTitle(p.title);
    setFormType(p.type as 'news' | 'announcement');
    setFormStatus(p.status as 'active' | 'closed');
    setFormPublishAt(format(new Date(p.publishAt), "yyyy-MM-dd'T'HH:mm"));
    setFormTeaser('');
    setFormContent('');
    setFormKeywords('');
    setFormAllowComments(true);
    setFormAllowRating(true);
    setFormOpen(true);
    fetch(`/api/portal/admin/publications/${p.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.publication) {
          setFormTeaser(d.publication.teaser ?? '');
          setFormContent(d.publication.content ?? '');
          setFormKeywords(d.publication.keywords ?? '');
          setFormAllowComments(d.publication.allowComments ?? true);
          setFormAllowRating(d.publication.allowRating ?? true);
        }
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formContent.trim()) {
      toast.error('Текст обязателен');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: formTitle.trim() || undefined,
        type: formType,
        status: formStatus,
        publishAt: new Date(formPublishAt).toISOString(),
        teaser: formType === 'news' ? (formTeaser.trim() || null) : null,
        content: formContent,
        keywords: formKeywords.trim() || null,
        allowComments: formAllowComments,
        allowRating: formAllowRating,
      };
      if (editingId) {
        const r = await fetch(`/api/portal/admin/publications/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? 'Ошибка');
        }
        toast.success('Публикация обновлена');
      } else {
        const r = await fetch('/api/portal/admin/publications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? 'Ошибка');
        }
        toast.success('Публикация создана');
      }
      setFormOpen(false);
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setSaving(false);
  }

  async function handleDelete(p: PubRow) {
    setDeleteTarget(null);
    setDeleting(true);
    try {
      const r = await fetch(`/api/portal/admin/publications/${p.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка удаления');
      toast.success('Публикация удалена');
      await loadList();
    } catch {
      toast.error('Не удалось удалить');
    }
    setDeleting(false);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={setSearch}
          placeholder="Поиск по названию..."
          wrapperClassName="max-w-xs"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">Все типы</option>
          <option value="news">Новость</option>
          <option value="announcement">Объявление</option>
        </select>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Создать
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Дата размещения</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Просмотры</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="Нет публикаций"
                    description="Создайте новость или объявление"
                    icon={<FileText className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell className="text-text-muted">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-dark">{p.title}</TableCell>
                  <TableCell className="text-text-muted">
                    {p.type === 'news' ? 'Новость' : 'Объявление'}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {format(new Date(p.publishAt), 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    {p.status === 'active' ? (
                      <span className="text-green-600">Действительна</span>
                    ) : (
                      <span className="text-amber-600">Закрыта</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-text-muted">{p.viewsCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/news/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-primary"
                        title="Предпросмотр"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-primary"
                        title="Редактировать"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-red-600"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редактировать публикацию' : 'Новая публикация'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pub-title">Название (если пусто — из текста)</Label>
              <Input
                id="pub-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Заголовок"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Тип</Label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as 'news' | 'announcement')}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="news">Новость</option>
                  <option value="announcement">Объявление</option>
                </select>
              </div>
              <div>
                <Label>Статус</Label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'active' | 'closed')}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="active">Действительна</option>
                  <option value="closed">Закрыта</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="pub-publish">Дата размещения</Label>
              <Input
                id="pub-publish"
                type="datetime-local"
                value={formPublishAt}
                onChange={(e) => setFormPublishAt(e.target.value)}
                className="mt-1"
              />
            </div>
            {formType === 'news' && (
              <div>
                <Label htmlFor="pub-teaser">Анонс (для списка новостей)</Label>
                <textarea
                  id="pub-teaser"
                  value={formTeaser}
                  onChange={(e) => setFormTeaser(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <Label htmlFor="pub-content">Текст (HTML)</Label>
              <textarea
                id="pub-content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={8}
                required
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <Label htmlFor="pub-keywords">Ключевые слова</Label>
              <Input
                id="pub-keywords"
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                placeholder="через запятую"
                className="mt-1"
              />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formAllowComments}
                  onChange={(e) => setFormAllowComments(e.target.checked)}
                />
                <span className="text-sm">Разрешить комментарии</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formAllowRating}
                  onChange={(e) => setFormAllowRating(e.target.checked)}
                />
                <span className="text-sm">Разрешить оценку</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить публикацию?"
        description={deleteTarget ? `«${deleteTarget.title}» будет удалена безвозвратно.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
      />
    </div>
  );
}
