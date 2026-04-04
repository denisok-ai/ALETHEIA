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
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tariff?: TariffItem;
}

/**
 * Форма вынесена в отдельный компонент: при вводе перерисовывается только она,
 * а не весь Dialog (оверлей, backdrop, разметка модалки) — убирает лаги по символам.
 */
function PaymentModalForm({ tariff }: { tariff: TariffItem }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, string> = {
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
      };
      if (tariff.slug) {
        body.serviceSlug = tariff.slug;
      } else {
        body.tariffId = tariff.id;
      }
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: { success?: boolean; paymentUrl?: string; error?: string };
      try {
        const text = await res.text();
        data = text ? (JSON.parse(text) as { success?: boolean; paymentUrl?: string; error?: string }) : {};
      } catch {
        toast.error('Не удалось создать платёж. Попробуйте позже или свяжитесь с нами.');
        return;
      }
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        const msg = data?.error || (res.ok ? '' : 'Ошибка сервера. Попробуйте позже или свяжитесь с нами.');
        toast.error(msg || 'Не удалось создать платёж. Попробуйте позже или свяжитесь с нами.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сети. Проверьте подключение и попробуйте снова. Или свяжитесь с нами.');
    } finally {
      setLoading(false);
    }
  };

  const priceLabel =
    tariff.price <= 0 ? 'Бесплатно' : `${tariff.price.toLocaleString('ru-RU')} ₽`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="pm-email">Email *</Label>
        <Input
          id="pm-email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="your@email.com"
          className="mt-1"
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor="pm-name">Имя *</Label>
        <Input
          id="pm-name"
          required
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Иван Иванов"
          className="mt-1"
          autoComplete="name"
        />
      </div>
      <div>
        <Label htmlFor="pm-phone">Телефон</Label>
        <Input
          id="pm-phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="+7 (900) 123-45-67"
          className="mt-1"
          autoComplete="tel"
        />
      </div>
      <div className="rounded-lg bg-[var(--lavender-light)] p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[var(--text)]">Итого:</span>
          <span className="text-2xl font-bold text-plum">{priceLabel}</span>
        </div>
      </div>
      <Button type="submit" variant="landingPlum" className="w-full" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tariff.price <= 0 ? 'Оформление…' : 'Создание платежа...'}
          </>
        ) : tariff.price <= 0 ? (
          'Получить доступ'
        ) : (
          'Перейти к оплате'
        )}
      </Button>
      <p className="text-xs text-[var(--text-muted)] text-center">
        {tariff.price <= 0 ? (
          <>
            Нажимая кнопку, вы соглашаетесь с{' '}
            <a href="/privacy" className="underline hover:text-plum">
              политикой конфиденциальности
            </a>
            .
          </>
        ) : (
          <>
            Нажимая кнопку, вы соглашаетесь с{' '}
            <a href="/oferta#oplata" className="underline hover:text-plum">
              офертой
            </a>{' '}
            и{' '}
            <a href="/privacy" className="underline hover:text-plum">
              политикой конфиденциальности
            </a>
            .
          </>
        )}
      </p>
    </form>
  );
}

export function PaymentModal({ isOpen, onClose, tariff }: PaymentModalProps) {
  if (!tariff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оформление: {tariff.name}</DialogTitle>
        </DialogHeader>
        <PaymentModalForm tariff={tariff} />
      </DialogContent>
    </Dialog>
  );
}
