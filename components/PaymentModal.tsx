'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TariffItem } from '@/components/sections/Pricing';
import { Loader2 } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tariff?: TariffItem;
}

export function PaymentModal({ isOpen, onClose, tariff }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tariff) return;
    setLoading(true);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tariffId: tariff.id,
          ...formData,
        }),
      });
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error || 'Ошибка создания платежа');
      }
    } catch (err) {
      console.error(err);
      alert('Произошла ошибка. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  if (!tariff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оформление: {tariff.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pm-email">Email *</Label>
            <Input
              id="pm-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="your@email.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pm-name">Имя *</Label>
            <Input
              id="pm-name"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Иван Иванов"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pm-phone">Телефон</Label>
            <Input
              id="pm-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+7 (900) 123-45-67"
              className="mt-1"
            />
          </div>
          <div className="rounded-lg bg-bg-soft p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-dark">Итого:</span>
              <span className="text-2xl font-bold text-accent">
                {tariff.price.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание платежа...
              </>
            ) : (
              'Перейти к оплате'
            )}
          </Button>
          <p className="text-xs text-text-muted text-center">
            Нажимая кнопку, вы соглашаетесь с{' '}
            <a href="/oferta" className="underline hover:text-accent">офертой</a>{' '}
            и{' '}
            <a href="/privacy" className="underline hover:text-accent">политикой конфиденциальности</a>.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
