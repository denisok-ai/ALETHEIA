'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CreateInstallmentDialogProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  amount: number;
  clientEmail: string;
  clientName?: string;
  onSuccess: () => void;
}

export function CreateInstallmentDialog({
  open,
  onClose,
  orderNumber,
  amount,
  clientEmail,
  clientName,
  onSuccess,
}: CreateInstallmentDialogProps) {
  const [totalParts, setTotalParts] = useState(3);
  const [firstPaymentNow, setFirstPaymentNow] = useState(true);
  const [creating, setCreating] = useState(false);

  const partAmount = Math.floor(amount / totalParts);
  const remainder = amount - partAmount * totalParts;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/portal/admin/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, totalParts, firstPaymentNow }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Ошибка создания рассрочки');
        setCreating(false);
        return;
      }
      toast.success(`Рассрочка создана: ${totalParts} частей по ${partAmount} ₽`);
      if (data.firstPaymentUrl) {
        toast.info('Ссылка на первый платёж скопирована в буфер');
        navigator.clipboard.writeText(data.firstPaymentUrl);
      }
      onSuccess();
      onClose();
    } catch {
      toast.error('Ошибка сети');
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Оформить рассрочку</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p><span className="text-gray-500">Заказ:</span> <strong>{orderNumber}</strong></p>
            <p><span className="text-gray-500">Клиент:</span> {clientName || clientEmail}</p>
            <p><span className="text-gray-500">Сумма:</span> <strong>{amount.toLocaleString('ru-RU')} ₽</strong></p>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Количество частей</span>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setTotalParts(n)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    totalParts === n
                      ? 'bg-[#2D1B4E] text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#F6F4F9] rounded-lg p-3 text-sm">
            <p>График: <strong>{totalParts}</strong> платежей по <strong>{partAmount} ₽</strong></p>
            {remainder > 0 && <p className="text-gray-500">Первый платёж: {partAmount + remainder} ₽ (с остатком)</p>}
            <p className="text-gray-500 mt-1">Интервал: 30 дней между платежами</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={firstPaymentNow}
              onChange={(e) => setFirstPaymentNow(e.target.checked)}
              className="rounded"
            />
            Создать ссылку на первый платёж сейчас
          </label>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={onClose} disabled={creating}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Создание…' : 'Оформить рассрочку'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
