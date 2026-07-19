'use client';

/**
 * Admin: статьи блога — список, создание, правка, удаление.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { TablePagination, STANDARD_PAGE_SIZES } from '@/components/ui/TablePagination';
import { Plus, Pencil, Trash2, ExternalLink, FileText } from 'lucide-react';

export interface BlogRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

type FormState = {
  id: string | null;
  slug: string;
  title: string;
  h1: string;
  description: string;
  body: string;
  bodyFormat: 'markdown' | 'paragraphs';
  ogImage: string;
  coverImage: string;
  status: 'draft' | 'published';
};

const EMPTY_FORM: FormState = {
  id: null,
  slug: '',
  title: '',
  h1: '',
  description: '',
  body: '',
  bodyFormat: 'markdown',
  ogImage: '',
  coverImage: '',
  status: 'draft',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function BlogAdminClient({ initialPosts }: { initialPosts: BlogRow[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BlogRow | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Статей будет много: автопубликация из канала добавляет их ежедневно.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [posts, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  async function refresh() {
    const r = await fetch('/api/portal/admin/blog');
    if (r.ok) {
      const data = (await r.json()) as { posts: BlogRow[] };
      setPosts(data.posts);
    }
    // Страницы блога кэшируются — обновляем, чтобы правка была видна сразу.
    router.refresh();
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  async function openEdit(row: BlogRow) {
    const r = await fetch(`/api/portal/admin/blog/${row.id}`);
    if (!r.ok) {
      toast.error('Не удалось открыть статью');
      return;
    }
    const { post } = (await r.json()) as { post: FormState & { bodyFormat: string } };
    setForm({
      id: row.id,
      slug: post.slug,
      title: post.title,
      h1: post.h1,
      description: post.description,
      body: post.body,
      bodyFormat: post.bodyFormat === 'paragraphs' ? 'paragraphs' : 'markdown',
      ogImage: post.ogImage ?? '',
      coverImage: (post as unknown as { coverImage?: string }).coverImage ?? '',
      status: post.status === 'published' ? 'published' : 'draft',
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const r = await fetch(isEdit ? `/api/portal/admin/blog/${form.id}` : '/api/portal/admin/blog', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug,
          title: form.title,
          h1: form.h1,
          description: form.description,
          body: form.body,
          bodyFormat: form.bodyFormat,
          ogImage: form.ogImage,
          coverImage: form.coverImage,
          status: form.status,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error ?? 'Не удалось сохранить');
        return;
      }
      toast.success(isEdit ? 'Статья сохранена' : 'Статья создана');
      setOpen(false);
      await refresh();
    } catch {
      toast.error('Сбой сети — статья не сохранена');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const r = await fetch(`/api/portal/admin/blog/${deleting.id}`, { method: 'DELETE' });
    if (!r.ok) {
      toast.error('Не удалось удалить статью');
      return;
    }
    toast.success('Статья удалена');
    setDeleting(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          defaultValue={search}
          onSearch={(v: string) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Поиск по заголовку или адресу"
          wrapperClassName="w-full sm:w-80"
        />
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Новая статья
        </Button>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Статей пока нет"
          description="Создайте первую статью — она появится в блоге сайта после публикации."
        />
      ) : (
        <div className="portal-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заголовок</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Источник</TableHead>
                <TableHead>Публикация</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{p.slug}</TableCell>
                  <TableCell>
                    <span
                      className={
                        p.status === 'published'
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700'
                      }
                    >
                      {p.status === 'published' ? 'Опубликована' : 'Черновик'}
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {p.source === 'telegram' ? 'Telegram' : 'Вручную'}
                  </TableCell>
                  <TableCell>{formatDate(p.publishedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.status === 'published' && (
                        <a
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Открыть на сайте"
                        >
                          <Button variant="ghost" size="sm" className="p-0 h-9 w-9">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" className="p-0 h-9 w-9" onClick={() => openEdit(p)} title="Изменить">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-9 w-9 text-[var(--portal-text-soft)] hover:text-red-500"
                        onClick={() => setDeleting(p)}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={safePage}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Изменить статью' : 'Новая статья'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="b-title">Заголовок для поиска</Label>
              <Input
                id="b-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ваше тело уже знает ответ: как научиться его слышать"
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Показывается в поисковой выдаче и во вкладке браузера.
              </p>
            </div>
            <div>
              <Label htmlFor="b-h1">Заголовок на странице</Label>
              <Input
                id="b-h1"
                value={form.h1}
                onChange={(e) => setForm({ ...form, h1: e.target.value })}
                placeholder="Пусто — возьмётся заголовок для поиска"
              />
            </div>
            <div>
              <Label htmlFor="b-slug">Адрес статьи</Label>
              <Input
                id="b-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="telo-znaet-otvet"
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Латиница, цифры и дефисы. Будет виден в ссылке: /blog/{form.slug || 'адрес'}.
                После публикации менять нежелательно — старая ссылка перестанет работать.
              </p>
            </div>
            <div>
              <Label htmlFor="b-descr">Описание для поисковой выдачи</Label>
              <textarea
                id="b-descr"
                rows={2}
                className="mt-1 w-full rounded-md border border-[var(--portal-border)] bg-transparent p-2 text-sm"
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
                placeholder="Одно-два предложения о статье — их увидят в результатах поиска."
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                {form.description.length} символов (лучше 120–160).
              </p>
            </div>
            <div>
              <Label htmlFor="b-body">Текст статьи</Label>
              <textarea
                id="b-body"
                rows={14}
                className="mt-1 w-full rounded-md border border-[var(--portal-border)] bg-transparent p-2 font-mono text-sm"
                value={form.body}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, body: e.target.value })}
                placeholder={
                  form.bodyFormat === 'markdown'
                    ? '## Подзаголовок\n\nАбзац текста. Можно **выделять** и делать списки.'
                    : 'Абзац первый.\n\nАбзац второй.'
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.bodyFormat === 'markdown'}
                    onChange={() => setForm({ ...form, bodyFormat: 'markdown' })}
                  />
                  Markdown (подзаголовки, списки, ссылки)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.bodyFormat === 'paragraphs'}
                    onChange={() => setForm({ ...form, bodyFormat: 'paragraphs' })}
                  />
                  Простые абзацы
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Абзацы разделяются пустой строкой. {form.body.length} символов.
              </p>
            </div>
            <div>
              <Label htmlFor="b-cover">Иллюстрация статьи</Label>
              <Input
                id="b-cover"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder="/uploads/blog/moya-statya.jpg"
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Показывается вверху статьи и в карточке списка. Пусто — статья без картинки.
              </p>
            </div>
            <div>
              <Label htmlFor="b-og">Картинка для соцсетей</Label>
              <Input
                id="b-og"
                value={form.ogImage}
                onChange={(e) => setForm({ ...form, ogImage: e.target.value })}
                placeholder="/images/og/blog-telo-znaet-otvet.png"
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Пусто — возьмётся общая картинка сайта.
              </p>
            </div>
            <div>
              <Label htmlFor="b-status">Статус</Label>
              <select
                id="b-status"
                className="mt-1 w-full rounded-md border border-[var(--portal-border)] bg-transparent p-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}
              >
                <option value="draft">Черновик — не виден на сайте</option>
                <option value="published">Опубликована — видна всем</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Удалить статью?"
        description={
          deleting
            ? `«${deleting.title}» будет удалена без возможности восстановления. Ссылка /blog/${deleting.slug} перестанет работать.`
            : ''
        }
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
