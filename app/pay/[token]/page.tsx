'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface CheckoutData {
  status: string;
  product: { name: string; description: string | null; priceRub: number; installmentEnabled: boolean; maxInstallments: number };
  clientEmail: string | null;
  clientName: string | null;
}

export default function PayCheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [installmentParts, setInstallmentParts] = useState(0);

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setEmail(d.clientEmail || '');
        setName(d.clientName || '');
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    setPaying(true);
    setError('');
    try {
      const res = await fetch(`/api/pay/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail: email, clientName: name }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Ошибка оплаты');
        setPaying(false);
        return;
      }
      window.location.href = result.invoiceUrl;
    } catch {
      setError('Ошибка сети');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2D1B4E]" />
      </div>
    );
  }

  if (!data || data.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2">Срок действия ссылки истёк</h1>
          <p className="text-gray-600 mb-6">
            Пожалуйста, запросите новую ссылку у менеджера.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#1a1030] transition-colors"
          >
            На главную
          </button>
        </motion.div>
      </div>
    );
  }

  if (data.status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2">Оплачено</h1>
          <p className="text-gray-600 mb-6">
            Оплата по услуге «{data.product.name}» успешно получена.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#1a1030] transition-colors"
          >
            На главную
          </button>
        </motion.div>
      </div>
    );
  }

  if (data.status === 'cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
        >
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2">Ссылка отменена</h1>
          <p className="text-gray-600 mb-6">
            Данная платёжная ссылка была отменена. Пожалуйста, обратитесь к менеджеру для получения новой.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#1a1030] transition-colors"
          >
            На главную
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F4F9] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full"
      >
        <div className="flex justify-center mb-6">
          <Image src="/images/LOGO.png" alt="АВАТЕРРА" width={120} height={40} />
        </div>
        <h1 className="text-xl font-semibold text-[#2D1B4E] mb-2 text-center">
          {data.product.name}
        </h1>
        {data.product.description && (
          <p className="text-gray-600 mb-4 text-center text-sm">
            {data.product.description}
          </p>
        )}
        <div className="bg-[#F6F4F9] rounded-xl p-4 mb-6 text-center">
          <span className="text-3xl font-bold text-[#2D1B4E]">
            {data.product.priceRub.toLocaleString('ru-RU')} ₽
          </span>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="pay-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="pay-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label htmlFor="pay-name" className="block text-sm font-medium text-gray-700 mb-1">
              Имя
            </label>
            <input
              id="pay-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent outline-none"
            />
          </div>
        </div>
        {data?.product.installmentEnabled && data.product.priceRub >= 100 && (
          <div className="bg-[#F6F4F9] rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-[#2D1B4E] mb-2">Или оплатите частями:</p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: data.product.maxInstallments - 1 }, (_, i) => i + 2).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInstallmentParts(installmentParts === n ? 0 : n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    installmentParts === n
                      ? 'bg-[#2D1B4E] text-white'
                      : 'bg-white border hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {n}× {Math.ceil(data.product.priceRub / n).toLocaleString('ru-RU')} ₽
                </button>
              ))}
            </div>
            {installmentParts > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Первый платёж: {Math.ceil(data.product.priceRub / installmentParts)} ₽, затем {installmentParts - 1} ежемесячных списания
              </p>
            )}
          </div>
        )}
        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full py-3 bg-[#D4AF37] text-[#2D1B4E] font-semibold rounded-lg hover:bg-[#c9a030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {paying ? 'Перенаправление…' : 'Оплатить'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-4">
          Безопасная оплата через PayKeeper
        </p>
      </motion.div>
    </div>
  );
}
