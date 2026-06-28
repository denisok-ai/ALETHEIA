'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface InstallmentPlan {
  id: string;
  status: string;
  totalParts: number;
  partAmountRub: number;
  nextPaymentAt: string | null;
  createdAt: string;
  order: { orderNumber: string; clientEmail: string; clientName: string | null; amount: number };
  payments: { partNumber: number; amountRub: number; status: string; scheduledAt: string; paidAt: string | null }[];
}

const statusLabels: Record<string, { text: string; color: string }> = {
  active: { text: 'Активна', color: 'bg-blue-100 text-blue-800' },
  completed: { text: 'Завершена', color: 'bg-green-100 text-green-800' },
  defaulted: { text: 'Просрочена', color: 'bg-red-100 text-red-800' },
  cancelled: { text: 'Отменена', color: 'bg-gray-100 text-gray-600' },
};

export default function InstallmentsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portal/admin/installments')
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const paidCount = (p: InstallmentPlan) => p.payments.filter((x) => x.status === 'paid').length;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#2D1B4E] mb-6">Рассрочки</h1>

      {plans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">Нет оформленных рассрочек</p>
          <p className="text-sm">Рассрочки появятся здесь после оформления</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/portal/admin/installments/${plan.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-[#2D1B4E]">
                      {plan.order.clientName || plan.order.clientEmail}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[plan.status]?.color || 'bg-gray-100'}`}>
                      {statusLabels[plan.status]?.text || plan.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Заказ: {plan.order.orderNumber}</span>
                    <span>{plan.order.amount.toLocaleString('ru-RU')} ₽</span>
                    <span>{plan.totalParts} частей по {plan.partAmountRub.toLocaleString('ru-RU')} ₽</span>
                    <span>Оплачено: {paidCount(plan)}/{plan.totalParts}</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 max-w-xs">
                    <div
                      className="bg-[#D4AF37] h-1.5 rounded-full transition-all"
                      style={{ width: `${(paidCount(plan) / plan.totalParts) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {plan.nextPaymentAt && (
                    <p>След. платёж: {new Date(plan.nextPaymentAt).toLocaleDateString('ru-RU')}</p>
                  )}
                  <p>{new Date(plan.createdAt).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
