'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Package, Pencil, Trash2 } from 'lucide-react';

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slug: '',
    name: '',
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      slug: '',
      name: '',
      price: 0,
      paykeeperTariffId: '',
      courseId: '',
      isActive: true,
    });
    setModalOpen(true);
  }

  function openEdit(s: ServiceRow) {
    setEditing(s);
    setForm({
      slug: s.slug,
      name: s.name,
      price: s.price,
      paykeeperTariffId: s.paykeeperTariffId ?? '',
      courseId: s.courseId ?? '',
      isActive: s.isActive,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.courseId.trim() && !form.paykeeperTariffId.trim()) {
      alert('Укажите ID тарифа PayKeeper — без него оплаченные заказы не привяжутся к курсу.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        price: Number(form.price) || 0,
        paykeeperTariffId: form.paykeeperTariffId.trim() || null,
        courseId: form.courseId.trim() || null,
        isActive: form.isActive,
      };
      if (editing) {
        const res = await fetch(`/api/portal/admin/services/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Ошибка');
        }
        setServices((prev) =>
          prev.map((s) => (s.id === editing.id ? { ...s, ...payload, paykeeperTariffId: payload.paykeeperTariffId, courseId: payload.courseId, courseTitle: payload.courseId ? courses.find((c) => c.id === payload.courseId)?.title ?? null : null } : s))
        );
        setModalOpen(false);
      } else {
        const res = await fetch('/api/portal/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Ошибка');
        }
        const data = await res.json();
        setServices((prev) => [
          {
            id: data.service.id,
            slug: data.service.slug,
            name: data.service.name,
            price: data.service.price,
            paykeeperTariffId: data.service.paykeeperTariffId,
            courseId: data.service.courseId,
            courseTitle: data.service.courseId ? courses.find((c) => c.id === data.service.courseId)?.title ?? null : null,
            isActive: data.service.isActive,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setModalOpen(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения');
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
    } catch {
      alert('Ошибка удаления');
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
    <div className="portal-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--portal-text)]">Товары для продажи на главной</h2>
        <Button size="sm" onClick={openCreate}>
          Добавить товар
        </Button>
      </div>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Эти товары отображаются в блоке «Купить курс» на главной. Укажите slug, название, цену и ID тарифа PayKeeper; привяжите курс для автоматического зачисления после оплаты.
      </p>
      <div className="mt-4 overflow-x-auto">
        {services.length === 0 ? (
          <EmptyState
            title="Нет товаров"
            description="Добавьте товар, чтобы он отображался в магазине на главной"
            icon={<Package className="h-10 w-10" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Тариф PayKeeper</TableHead>
                <TableHead>Курс</TableHead>
                <TableHead>Активен</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.slug}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.price.toLocaleString('ru')} ₽</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{s.paykeeperTariffId ?? '—'}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{s.courseTitle ?? '—'}</TableCell>
                  <TableCell>{s.isActive ? 'Да' : 'Нет'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} aria-label="Редактировать">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteTarget(s)} aria-label="Удалить">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать товар' : 'Новый товар'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="svc-slug">Slug (латиница, для URL)</Label>
              <Input
                id="svc-slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="course-avaterra"
                disabled={!!editing}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="svc-name">Название</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Курс AVATERRA"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="svc-price">Цена (₽)</Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                value={form.price || ''}
                onChange={(e) => setForm((p) => ({ ...p, price: parseInt(e.target.value, 10) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="svc-tariff">ID тарифа PayKeeper *</Label>
              <Input
                id="svc-tariff"
                value={form.paykeeperTariffId}
                onChange={(e) => setForm((p) => ({ ...p, paykeeperTariffId: e.target.value }))}
                placeholder="course (как в ЛК PayKeeper)"
                className="mt-1"
              />
              {form.courseId && !form.paykeeperTariffId.trim() && (
                <p className="mt-1 text-sm text-amber-600" role="alert">
                  При привязанном курсе укажите ID тарифа PayKeeper — иначе оплаченные заказы не привяжутся к курсу и зачисление не создастся.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="svc-course">Курс (для зачисления после оплаты)</Label>
              <select
                id="svc-course"
                value={form.courseId}
                onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="">— не привязан</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="svc-active"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-[#E2E8F0]"
              />
              <Label htmlFor="svc-active" className="font-normal">Показывать в магазине</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение…' : editing ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить товар?"
        description={deleteTarget ? `Товар «${deleteTarget.name}» будет удалён. Заказы по нему не затрагиваются.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
      />
    </div>
  );
}
