'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/portal/Card';
import { PlayCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceOption {
  id: string;
  slug: string;
  name: string;
  price: number;
  isActive: boolean;
  courseId: string | null;
}

export function SimulatePaymentBlock() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Тест');
  const [serviceSlug, setServiceSlug] = useState('');

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/admin/services');
      if (res.ok) {
        const d = await res.json();
        const list = (d.services ?? []).filter((s: ServiceOption) => s.isActive);
        setServices(list);
        if (list.length > 0) setServiceSlug((prev) => prev || list[0].slug);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !serviceSlug.trim()) {
      toast.error('Укажите email и выберите товар');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/admin/payments/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          serviceSlug: serviceSlug.trim(),
          name: name.trim() || 'Тест',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка симуляции');
        return;
      }
      toast.success(`Оплата симулирована. Заказ ${data.orderNumber}. Проверьте «Мои курсы» у пользователя.`);
      router.refresh();
    } catch {
      toast.error('Ошибка запроса');
    } finally {
      setSubmitting(false);
    }
  }

  const activeServices = services.filter((s) => s.isActive);

  return (
    <Card title="Симуляция оплаты (без PayKeeper)" description="Создаёт заказ и обрабатывает его как оплаченный: запись на курс, письмо. Для проверки сценария «оплата → доступ к курсу». Настройки берутся из панели (Настройки → Платежи не требуются для симуляции).">
      {loading ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка товаров…</p>
      ) : activeServices.length === 0 ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Нет активных товаров. Добавьте товар в блоке выше и привяжите курс.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <Label htmlFor="sim-service">Товар (услуга)</Label>
            <select
              id="sim-service"
              value={serviceSlug}
              onChange={(e) => setServiceSlug(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {activeServices.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name} ({s.slug}) — {s.price.toLocaleString('ru')} ₽
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px]">
            <Label htmlFor="sim-email">Email пользователя *</Label>
            <Input
              id="sim-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student1@test.local"
              className="mt-1"
            />
          </div>
          <div className="min-w-[160px]">
            <Label htmlFor="sim-name">Имя</Label>
            <Input
              id="sim-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Тест"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={submitting} variant="secondary">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Выполняется…
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Симулировать оплату
              </>
            )}
          </Button>
        </form>
      )}
    </Card>
  );
}
