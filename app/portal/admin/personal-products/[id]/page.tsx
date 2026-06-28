'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface PaymentLink {
  id: string;
  token: string;
  status: string;
  clientEmail: string | null;
  clientName: string | null;
  createdAt: string;
  paidAt: string | null;
  order: { orderNumber: string; status: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceRub: number;
  expiresAt: string | null;
  isActive: boolean;
}

export default function PersonalProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/portal/admin/personal-products`).then((r) => r.json()),
      fetch(`/api/portal/admin/personal-products/${id}/links`).then((r) => r.json()),
    ])
      .then(([products, linksData]) => {
        setProduct(products.find((p: Product) => p.id === id) || null);
        setLinks(linksData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/portal/admin/personal-products/${id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail: clientEmail || undefined, clientName: clientName || undefined }),
      });
      if (res.ok) {
        setClientEmail('');
        setClientName('');
        fetchData();
      }
    } catch {}
    setGenerating(false);
  };

  const handleCancel = async (linkId: string) => {
    if (!confirm('Отменить эту ссылку? Клиент не сможет оплатить.')) return;
    try {
      await fetch(`/api/portal/admin/payment-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      fetchData();
    } catch {}
  };

  const handleRestore = async (linkId: string) => {
    try {
      await fetch(`/api/portal/admin/payment-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      fetchData();
    } catch {}
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Удалить ссылку? Это действие необратимо.')) return;
    try {
      const res = await fetch(`/api/portal/admin/payment-links/${linkId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {}
  };

  const copyLink = (token: string, linkId: string) => {
    const url = `${window.location.origin}/pay/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-800' },
    paid: { text: 'Оплачен', color: 'bg-green-100 text-green-800' },
    expired: { text: 'Просрочен', color: 'bg-red-100 text-red-800' },
    cancelled: { text: 'Отменён', color: 'bg-gray-100 text-gray-600' },
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Товар не найден</p>
        <button onClick={() => router.push('/portal/admin/personal-products')} className="mt-4 text-[#2D1B4E] underline">
          ← Назад к списку
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/portal/admin/personal-products')}
        className="text-sm text-gray-500 hover:text-[#2D1B4E] mb-4 inline-block"
      >
        ← Персональные товары
      </button>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h1 className="text-2xl font-bold text-[#2D1B4E] mb-2">{product.name}</h1>
        {product.description && <p className="text-gray-600 mb-4">{product.description}</p>}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-2xl font-bold text-[#D4AF37]">
            {product.priceRub.toLocaleString('ru-RU')} ₽
          </span>
          {product.expiresAt && (
            <span className="text-gray-400">
              До {new Date(product.expiresAt).toLocaleDateString('ru-RU')}
            </span>
          )}
          <span className="text-gray-400">Ссылок: {links.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#2D1B4E] mb-4">Новая ссылка</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="Email клиента (опционально)"
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none text-sm"
          />
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Имя клиента (опционально)"
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2D1B4E] outline-none text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-[#D4AF37] text-[#2D1B4E] font-semibold rounded-lg hover:bg-[#c9a030] disabled:opacity-50 transition-colors text-sm"
          >
            {generating ? 'Генерация…' : '🔗 Сгенерировать ссылку'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {links.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Пока нет сгенерированных ссылок</p>
          </div>
        ) : (
          links.map((link) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl shadow-sm border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabel[link.status]?.color || 'bg-gray-100'}`}>
                      {statusLabel[link.status]?.text || link.status}
                    </span>
                    {link.order && (
                      <span className="text-xs text-gray-400">Заказ: {link.order.orderNumber}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {link.clientEmail && <span>{link.clientEmail}</span>}
                    {link.clientName && <span>{link.clientName}</span>}
                    <span>{new Date(link.createdAt).toLocaleString('ru-RU')}</span>
                    {link.paidAt && <span className="text-green-600">Оплачен {new Date(link.paidAt).toLocaleString('ru-RU')}</span>}
                  </div>
                  <div className="mt-2">
                    <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-600 break-all">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/pay/{link.token}
                    </code>
                  </div>
                </div>
                <button
                  onClick={() => copyLink(link.token, link.id)}
                  className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copiedId === link.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {copiedId === link.id ? '✓ Скопировано' : '📋 Копировать'}
                </button>
                {link.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(link.id)}
                    className="ml-2 px-3 py-2 rounded-lg text-sm text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
                    title="Отменить"
                  >
                    Отменить
                  </button>
                )}
                {link.status === 'cancelled' && (
                  <button
                    onClick={() => handleRestore(link.id)}
                    className="ml-2 px-3 py-2 rounded-lg text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Восстановить"
                  >
                    Восстановить
                  </button>
                )}
                {(link.status === 'cancelled' || link.status === 'expired') && (
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="ml-2 px-3 py-2 rounded-lg text-sm text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    title="Удалить"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
