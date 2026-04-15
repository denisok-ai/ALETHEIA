'use client';

/**
 * Товары для главной: таблица, форма создания/редактирования в карточке над таблицей. Страница: /portal/admin/shop.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ServiceAiHelper } from '@/components/portal/ServiceAiHelper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES } from '@/components/ui/TablePagination';
import { Package, Pencil, Trash2, Plus, Loader2, Sparkles, Upload, ImageIcon } from 'lucide-react';
import { formatRub } from '@/lib/format-ru';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateServiceForm(form: {
  slug: string;
  name: string;
  price: number;
  paykeeperTariffId: string;
  courseId: string;
}): string | null {
  const slug = form.slug.trim().toLowerCase();
  if (!slug) return 'Укажите slug (латиница, дефисы).';
  if (!SLUG_PATTERN.test(slug)) return 'Slug: только строчные латинские буквы, цифры и дефисы (например course-avaterra).';
  if (!form.name.trim()) return 'Укажите название товара.';
  if (form.price < 0) return 'Цена не может быть отрицательной.';
  if (form.courseId.trim() && !form.paykeeperTariffId.trim()) {
    return 'При выбранном курсе укажите ID тарифа в личном кабинете PayKeeper — иначе зачисление после оплаты не сработает.';
  }
  return null;
}

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  paykeeperTariffId: string | null;
  courseId: string | null;
  courseTitle: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ServicesAdminBlock() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  /** id редактируемой записи; null — режим создания (как в Neurocosmetics catalog: editingId + одна форма) */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Синхронный id для PATCH — избегает гонки, когда submit читает state до коммита setState */
  const editingIdRef = useRef<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'hidden'>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [genDescLoading, setGenDescLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [genImageLoading, setGenImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    imageUrl: '',
    price: 0,
    paykeeperTariffId: '',
    courseId: '',
    isActive: true,
  });

  const load = useCallback(async () => {
    try {
      const [svcRes, crsRes] = await Promise.all([
        fetch('/api/portal/admin/services'),
        fetch('/api/portal/admin/courses'),
      ]);
      if (svcRes.ok) {
        const d = await svcRes.json();
        setServices(d.services ?? []);
      }
      if (crsRes.ok) {
        const d = await crsRes.json();
        setCourses(d.courses ?? []);
      }
    } catch {
      /* сеть / JSON — не пробрасываем, чтобы await load() после сохранения не ломал успех PATCH/POST */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredServices = useMemo(() => {
    let list = [...services];
    const q = filterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          (s.courseTitle ?? '').toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q)
      );
    }
    if (filterActive === 'active') list = list.filter((s) => s.isActive);
    if (filterActive === 'hidden') list = list.filter((s) => !s.isActive);
    return list;
  }, [services, filterSearch, filterActive]);

  const totalFiltered = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageRows = useMemo(() => {
    const start = safePage * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, safePage, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function openCreate() {
    editingIdRef.current = null;
    setEditingId(null);
    setForm({
      slug: '',
      name: '',
      description: '',
      imageUrl: '',
      price: 0,
      paykeeperTariffId: '',
      courseId: '',
      isActive: true,
    });
    setSaveError(null);
    setFormOpen(true);
  }

  function openEdit(s: ServiceRow) {
    editingIdRef.current = s.id;
    setEditingId(s.id);
    setForm({
      slug: s.slug,
      name: s.name,
      description: s.description ?? '',
      imageUrl: s.imageUrl ?? '',
      price: s.price,
      paykeeperTariffId: s.paykeeperTariffId ?? '',
      courseId: s.courseId ?? '',
      isActive: s.isActive,
    });
    setSaveError(null);
    setFormOpen(true);
  }

  function closeForm() {
    editingIdRef.current = null;
    setFormOpen(false);
    setEditingId(null);
    setSaveError(null);
  }

  const courseTitleForForm = useMemo(
    () => courses.find((c) => c.id === form.courseId)?.title ?? null,
    [courses, form.courseId]
  );

  async function handleGenerateDescription() {
    const name = form.name.trim();
    if (!name) {
      toast.error('Ошибка', { description: 'Введите название товара' });
      return;
    }
    setGenDescLoading(true);
    try {
      const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction:
            'Сгенерируй краткое описание услуги для карточки «Купить курс» на главной сайта (2–4 предложения). Школа AVATERRA, мышечное тестирование, курсы и консультации. Без заголовков и списков.',
          context: [
            `Название: ${name}`,
            `Slug: ${form.slug.trim() || '—'}`,
            courseTitleForForm ? `Курс: ${courseTitleForForm}` : '',
            form.description.trim() ? `Черновик: ${form.description.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          maxTokens: 600,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Ошибка AI');
      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (content) setForm((p) => ({ ...p, description: content }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка генерации');
    } finally {
      setGenDescLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/portal/admin/services/upload-image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Ошибка загрузки');
      const url = typeof data.url === 'string' ? data.url : '';
      if (url) setForm((p) => ({ ...p, imageUrl: url }));
      toast.success('Изображение загружено');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleGenerateImage() {
    const name = form.name.trim();
    if (!name) {
      toast.error('Ошибка', { description: 'Введите название товара' });
      return;
    }
    setGenImageLoading(true);
    try {
      const res = await fetch('/api/portal/admin/services/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: form.description.trim() || undefined,
          courseTitle: courseTitleForForm ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Ошибка генерации');
      const url = typeof data.url === 'string' ? data.url : '';
      if (url) setForm((p) => ({ ...p, imageUrl: url }));
      toast.success('Обложка сгенерирована');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setGenImageLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateServiceForm(form);
    if (err) {
      setSaveError(err);
      toast.error(err);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const idForPatch = editingIdRef.current;
    const isEdit = Boolean(idForPatch);
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        price: Number(form.price) || 0,
        paykeeperTariffId: form.paykeeperTariffId.trim() || null,
        courseId: form.courseId.trim() || null,
        isActive: form.isActive,
      };
      if (isEdit && idForPatch) {
        const res = await fetch(`/api/portal/admin/services/${encodeURIComponent(idForPatch)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error ?? 'Ошибка');
        }
        const svc = (data as { service?: ServiceRow }).service;
        closeForm();
        if (svc?.id) {
          setServices((prev) =>
            prev.map((x) =>
              x.id === svc.id
                ? {
                    ...x,
                    slug: svc.slug,
                    name: svc.name,
                    description: svc.description ?? null,
                    imageUrl: svc.imageUrl ?? null,
                    price: svc.price,
                    paykeeperTariffId: svc.paykeeperTariffId ?? null,
                    courseId: svc.courseId ?? null,
                    courseTitle: svc.courseTitle ?? x.courseTitle,
                    isActive: svc.isActive,
                  }
                : x
            )
          );
        }
        await load();
        toast.success('Товар обновлён');
      } else {
        const res = await fetch('/api/portal/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? 'Ошибка');
        }
        closeForm();
        await load();
        toast.success('Товар создан');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: ServiceRow) {
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/portal/admin/services/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка удаления');
      setServices((prev) => prev.filter((x) => x.id !== s.id));
      if (editingId === s.id) closeForm();
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  if (loading) {
    return (
      <div className="portal-card p-6">
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка товаров…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {formOpen && (
        <div className="portal-card p-6">
          <div className="flex flex-row items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <h3 className="text-lg font-semibold text-[var(--portal-text)]">
              {editingId ? 'Редактировать товар' : 'Новый товар'}
            </h3>
            <Button type="button" variant="secondary" size="sm" onClick={closeForm}>
              Закрыть
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="svc-slug">Slug (латиница, для URL) *</Label>
                <Input
                  id="svc-slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))
                  }
                  placeholder="course-avaterra"
                  disabled={!!editingId}
                  className="font-mono"
                />
                <p className="text-xs text-[var(--portal-text-muted)]">
                  Только a–z, 0–9 и дефисы. После создания slug не меняется.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-name">Название *</Label>
                <Input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Курс AVATERRA"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="svc-desc">Описание для витрины</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handleGenerateDescription()}
                  disabled={genDescLoading}
                >
                  {genDescLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Сгенерировать описание
                </Button>
              </div>
              <textarea
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={4}
                placeholder="Текст на карточке тарифа на главной. Если пусто — подставится краткое описание курса."
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
              />
              <ServiceAiHelper
                context={{
                  name: form.name,
                  slug: form.slug,
                  courseTitle: courseTitleForForm,
                  description: form.description,
                }}
                onInsert={(text) => setForm((p) => ({ ...p, description: text }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Обложка карточки</Label>
              <div className="flex flex-wrap items-start gap-4">
                {form.imageUrl ? (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E2E8F0]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                    <ImageIcon className="h-10 w-10 text-slate-300" />
                  </div>
                )}
                <div className="flex min-w-[200px] flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLoading}
                    >
                      {uploadLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Загрузить фото
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={() => void handleGenerateImage()}
                      disabled={genImageLoading}
                    >
                      {genImageLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Сгенерировать (DALL·E)
                    </Button>
                  </div>
                  {form.imageUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto justify-start px-0 text-red-600"
                      onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))}
                    >
                      Удалить изображение
                    </Button>
                  ) : null}
                  <p className="text-xs text-[var(--portal-text-muted)]">JPEG, PNG, WebP до 5 МБ или URL ниже</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="или вставьте URL изображения"
                className="font-mono text-xs"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Цена (₽) *</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  value={form.price || ''}
                  onChange={(e) => setForm((p) => ({ ...p, price: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-course">Курс (для зачисления после оплаты)</Label>
                <select
                  id="svc-course"
                  value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
                >
                  <option value="">— не привязан</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-tariff">ID тарифа PayKeeper</Label>
              <Input
                id="svc-tariff"
                value={form.paykeeperTariffId}
                onChange={(e) => setForm((p) => ({ ...p, paykeeperTariffId: e.target.value }))}
                placeholder="как в ЛК PayKeeper → Тарифы"
              />
              <p className="text-xs text-[var(--portal-text-muted)]">
                Должен совпадать с тарифом в{' '}
                <a
                  href="https://help.paykeeper.ru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--portal-accent)] underline"
                >
                  личном кабинете PayKeeper
                </a>
                . Webhook сопоставляет заказ по этому ID.
              </p>
              {form.courseId && !form.paykeeperTariffId.trim() && (
                <p className="text-sm text-amber-600" role="alert">
                  При привязанном курсе укажите ID тарифа — иначе зачисление не создастся.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="svc-active"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-[#E2E8F0]"
              />
              <Label htmlFor="svc-active" className="font-normal">
                Показывать в магазине на главной
              </Label>
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex flex-wrap gap-2 border-t border-[#E2E8F0] pt-4">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingId ? 'Сохранить' : 'Создать'}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="portal-card p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" onClick={openCreate} className="gap-2 shrink-0" size="sm">
            <Plus className="h-4 w-4" />
            Добавить товар
          </Button>
        </div>
        {services.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Поиск по названию, slug или курсу…"
              value={filterSearch}
              onChange={(e) => {
                setFilterSearch(e.target.value);
                setPage(0);
              }}
              className="w-[min(100%,280px)]"
            />
            <select
              value={filterActive}
              onChange={(e) => {
                setFilterActive(e.target.value as 'all' | 'active' | 'hidden');
                setPage(0);
              }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)]"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="hidden">Скрытые</option>
            </select>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {totalFiltered === 0 ? (
            <EmptyState
              title={services.length === 0 ? 'Нет товаров' : 'Ничего не найдено'}
              description={
                services.length === 0
                  ? 'Добавьте товар, чтобы он отображался в магазине на главной'
                  : 'Измените фильтр или поиск'
              }
              icon={<Package className="h-10 w-10" />}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-[var(--portal-text-muted)]">
                Товары ({totalFiltered}
                {totalFiltered !== services.length && ` из ${services.length}`})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Фото</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Тариф PayKeeper</TableHead>
                    <TableHead>Курс</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-24">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="p-2">
                        {s.imageUrl ? (
                          <div className="h-10 w-10 overflow-hidden rounded border border-[#E2E8F0]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--portal-text-muted)]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{s.slug}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{formatRub(s.price)} ₽</TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{s.paykeeperTariffId ?? '—'}</TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{s.courseTitle ?? '—'}</TableCell>
                      <TableCell>
                        <span
                          className={
                            s.isActive
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                          }
                        >
                          {s.isActive ? 'Активен' : 'Скрыт'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(s)}
                            aria-label="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setDeleteTarget(s)}
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalFiltered > 0 && (
                <TablePagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  total={totalFiltered}
                  pageSize={pageSize}
                  pageSizeOptions={STANDARD_PAGE_SIZES}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => {
                    setPageSize(s);
                    setPage(0);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить товар?"
        description={deleteTarget ? `Товар «${deleteTarget.name}» будет удалён. Заказы по нему не затрагиваются.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
