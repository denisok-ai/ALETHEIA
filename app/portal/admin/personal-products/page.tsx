'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES } from '@/components/ui/TablePagination';
import { PersonalProductAiHelper } from '@/components/portal/PersonalProductAiHelper';
import { Package, Pencil, Trash2, Plus, Loader2, Copy, Sparkles } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PersonalProduct {
  id: string;
  name: string;
  description: string | null;
  priceRub: number;
  expiresAt: string | null;
  isActive: boolean;
  installmentEnabled: boolean;
  maxInstallments: number;
  createdAt: string;
  _count: { links: number };
}

export default function PersonalProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PersonalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', priceRub: '', expiresAt: '', installmentEnabled: false, maxInstallments: '3' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PersonalProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showAiHelper, setShowAiHelper] = useState(false);

  const fetchProducts = useCallback(() => {
    fetch('/api/portal/admin/personal-products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = useMemo(() => {
    const q = filterSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
    );
  }, [products, filterSearch]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  const resetForm = () => {
    setForm({ name: '', description: '', priceRub: '', expiresAt: '', installmentEnabled: false, maxInstallments: '3' });
    setEditingId(null);
    setShowCreate(false);
    setError('');
    setShowAiHelper(false);
  };

  const openEdit = (product: PersonalProduct) => {
    setForm({
      name: product.name,
      description: product.description || '',
      priceRub: String(product.priceRub),
      expiresAt: product.expiresAt ? product.expiresAt.slice(0, 16) : '',
      installmentEnabled: product.installmentEnabled,
      maxInstallments: String(product.maxInstallments),
    });
    setEditingId(product.id);
    setShowCreate(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.priceRub) {
      setError('Название и цена обязательны');
      return;
    }
    const price = parseInt(form.priceRub, 10);
    if (price < 10) {
      setError('Минимальная цена — 10 ₽');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        priceRub: price,
        expiresAt: form.expiresAt || undefined,
        installmentEnabled: form.installmentEnabled,
        maxInstallments: parseInt(form.maxInstallments, 10) || 3,
      };
      const url = editingId
        ? `/api/portal/admin/personal-products/${editingId}`
        : '/api/portal/admin/personal-products';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Ошибка');
        setSaving(false);
        return;
      }
      toast.success(editingId ? 'Товар обновлён' : 'Товар создан');
      resetForm();
      fetchProducts();
    } catch {
      setError('Ошибка сети');
    }
    setSaving(false);
  };

  const handleDuplicate = async (product: PersonalProduct) => {
    setSaving(true);
    try {
      const res = await fetch('/api/portal/admin/personal-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${product.name} (копия)`,
          description: product.description,
          priceRub: product.priceRub,
          expiresAt: product.expiresAt,
        }),
      });
      if (res.ok) {
        toast.success('Товар скопирован');
        fetchProducts();
      }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/portal/admin/personal-products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Ошибка удаления');
      } else {
        toast.success('Товар удалён');
        fetchProducts();
      }
    } catch {
      toast.error('Ошибка сети');
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D1B4E]">Персональные товары</h1>
          <p className="text-sm text-gray-500 mt-1">Разовые услуги с индивидуальными ссылками на оплату</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Создать товар
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#2D1B4E] mb-4">
            {editingId ? 'Редактирование товара' : 'Новый товар'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="pp-name" className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                id="pp-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none"
                placeholder="Консультация по мышечному тестированию"
              />
            </div>
            <div>
              <label htmlFor="pp-price" className="block text-sm font-medium text-gray-700 mb-1">Цена (₽) * (мин. 10)</label>
              <input
                id="pp-price"
                type="number"
                min={10}
                value={form.priceRub}
                onChange={(e) => setForm({ ...form, priceRub: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none"
                placeholder="5000"
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="pp-desc" className="block text-sm font-medium text-gray-700">Описание</label>
                <button
                  type="button"
                  onClick={() => setShowAiHelper(!showAiHelper)}
                  className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> {showAiHelper ? 'Скрыть AI' : 'Сгенерировать с AI'}
                </button>
              </div>
              {showAiHelper && (
                <PersonalProductAiHelper
                  context={{ name: form.name, description: form.description }}
                  onInsert={(text) => setForm({ ...form, description: text })}
                />
              )}
              <textarea
                id="pp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none mt-1"
                rows={3}
                placeholder="Краткое описание услуги для клиента"
              />
            </div>
            <div>
              <label htmlFor="pp-expires" className="block text-sm font-medium text-gray-700 mb-1">Срок действия</label>
              <input
                id="pp-expires"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Пусто = бессрочно</p>
            </div>
            <div className="md:col-span-2 space-y-3 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.installmentEnabled}
                  onChange={(e) => setForm({ ...form, installmentEnabled: e.target.checked })}
                  className="rounded"
                />
                Доступна рассрочка
              </label>
              {form.installmentEnabled && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Максимум частей:</span>
                  <div className="flex gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, maxInstallments: String(n) })}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          form.maxInstallments === String(n)
                            ? 'bg-[#2D1B4E] text-white'
                            : 'bg-white border hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {form.priceRub && parseInt(form.priceRub, 10) >= 10
                      ? `≈ ${Math.ceil(parseInt(form.priceRub, 10) / parseInt(form.maxInstallments, 10))} ₽/мес`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingId ? 'Сохранить' : 'Создать'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>Отмена</Button>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Найти товар…"
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(0); }}
            className="px-3 py-2 border rounded-lg text-sm w-full max-w-xs focus:ring-2 focus:ring-[#2D1B4E] outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title={products.length === 0 ? 'Нет персональных товаров' : 'Ничего не найдено'}
          description={products.length === 0 ? 'Создайте первый товар для генерации платёжных ссылок' : 'Попробуйте другой запрос'}
        />
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Рассрочка</TableHead>
                  <TableHead>Ссылок</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-gray-50"
                  >
                    <TableCell>
                      <div>
                        <button
                          onClick={() => router.push(`/portal/admin/personal-products/${product.id}`)}
                          className="font-medium text-[#2D1B4E] hover:underline text-left"
                        >
                          {product.name}
                        </button>
                        {product.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{product.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{product.priceRub.toLocaleString('ru-RU')} ₽</TableCell>
                    <TableCell>
                      {product.installmentEnabled ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          до {product.maxInstallments} частей
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{product._count.links}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {product.expiresAt ? new Date(product.expiresAt).toLocaleDateString('ru-RU') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(product.createdAt).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(product)} title="Редактировать">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicate(product)} title="Дублировать">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTarget(product)} title="Удалить">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить товар?"
        description={deleteTarget ? `«${deleteTarget.name}» будет удалён${deleteTarget._count.links > 0 ? `. Связанные неоплаченные ссылки (${deleteTarget._count.links}) тоже удалятся.` : '.'}` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
