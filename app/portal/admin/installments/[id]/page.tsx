'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface InstallmentPayment {
  id: string;
  partNumber: number;
  amountRub: number;
  status: string;
  scheduledAt: string;
  paidAt: string | null;
  paykeeperPaymentId: string | null;
  errorMessage: string | null;
  retryCount: number;
}

interface InstallmentPlan {
  id: string;
  status: string;
  totalParts: number;
  partAmountRub: number;
  nextPaymentAt: string | null;
  createdAt: string;
  order: { orderNumber: string; clientEmail: string; clientName: string | null; amount: number };
  payments: InstallmentPayment[];
}

const statusLabels: Record<string, { text: string; color: string }> = {
  active: { text: 'Активна', color: 'bg-blue-100 text-blue-800' },
  completed: { text: 'Завершена', color: 'bg-green-100 text-green-800' },
  defaulted: { text: 'Просрочена', color: 'bg-red-100 text-red-800' },
  cancelled: { text: 'Отменена', color: 'bg-gray-100 text-gray-600' },
};

const paymentStatusLabels: Record<string, { text: string; color: string }> = {
  scheduled: { text: 'Запланирован', color: 'bg-yellow-100 text-yellow-800' },
  paid: { text: 'Оплачен', color: 'bg-green-100 text-green-800' },
  failed: { text: 'Ошибка', color: 'bg-red-100 text-red-800' },
  overdue: { text: 'Просрочен', color: 'bg-orange-100 text-orange-800' },
};

export default function InstallmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<InstallmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchPlan = useCallback(() => {
    fetch(`/api/portal/admin/installments/${id}`)
      .then((r) => r.json())
      .then(setPlan)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Изменить статус на «${statusLabels[newStatus]?.text || newStatus}»?`)) return;
    setUpdating(true);
    try {
      await fetch(`/api/portal/admin/installments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPlan();
    } catch {}
    setUpdating(false);
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

  if (!plan) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>План рассрочки не найден</p>
        <button onClick={() => router.push('/portal/admin/installments')} className="mt-4 text-[#2D1B4E] underline">
          ← Назад
        </button>
      </div>
    );
  }

  const paidCount = plan.payments.filter((p) => p.status === 'paid').length;
  const paidTotal = plan.payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountRub, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/portal/admin/installments')}
        className="text-sm text-gray-500 hover:text-[#2D1B4E] mb-4 inline-block"
      >
        ← Рассрочки
      </button>

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#2D1B4E]">
            Рассрочка — {plan.order.clientName || plan.order.clientEmail}
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[plan.status]?.color || 'bg-gray-100'}`}>
            {statusLabels[plan.status]?.text || plan.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Заказ</p>
            <p className="font-medium">{plan.order.orderNumber}</p>
          </div>
          <div>
            <p className="text-gray-400">Сумма</p>
            <p className="font-medium">{plan.order.amount.toLocaleString('ru-RU')} ₽</p>
          </div>
          <div>
            <p className="text-gray-400">Частей</p>
            <p className="font-medium">{plan.totalParts} × {plan.partAmountRub.toLocaleString('ru-RU')} ₽</p>
          </div>
          <div>
            <p className="text-gray-400">Оплачено</p>
            <p className="font-medium">{paidCount}/{plan.totalParts} ({paidTotal.toLocaleString('ru-RU')} ₽)</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#D4AF37] h-2 rounded-full transition-all"
            style={{ width: `${(paidCount / plan.totalParts) * 100}%` }}
          />
        </div>
      </div>

      {plan.status === 'active' && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex gap-3">
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={updating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Завершить
          </button>
          <button
            onClick={() => handleStatusChange('defaulted')}
            disabled={updating}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            Просрочена
          </button>
          <button
            onClick={() => handleStatusChange('cancelled')}
            disabled={updating}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            Отменить
          </button>
        </div>
      )}

      <h2 className="text-lg font-semibold text-[#2D1B4E] mb-4">График платежей</h2>
      <div className="space-y-3">
        {plan.payments.map((payment) => (
          <motion.div
            key={payment.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl shadow-sm border p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-[#2D1B4E] w-8 text-center">
                  {payment.partNumber}
                </span>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusLabels[payment.status]?.color || 'bg-gray-100'}`}>
                    {paymentStatusLabels[payment.status]?.text || payment.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    {payment.scheduledAt
                      ? `План: ${new Date(payment.scheduledAt).toLocaleDateString('ru-RU')}`
                      : 'Без даты'}
                  </p>
                  {payment.paidAt && (
                    <p className="text-sm text-green-600 mt-1">
                      Оплачен: {new Date(payment.paidAt).toLocaleString('ru-RU')}
                    </p>
                  )}
                  {payment.errorMessage && (
                    <p className="text-sm text-red-500 mt-1">{payment.errorMessage}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#2D1B4E]">
                  {payment.amountRub.toLocaleString('ru-RU')} ₽
                </p>
                {payment.retryCount > 0 && (
                  <p className="text-xs text-gray-400">Попыток: {payment.retryCount}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
