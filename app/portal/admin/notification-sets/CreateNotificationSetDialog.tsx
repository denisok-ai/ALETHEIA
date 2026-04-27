'use client';

/**
 * Dialog for creating a new notification set.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NOTIFICATION_SET_EVENT_LABELS } from '@/lib/notification-set-events';

const EVENT_TYPES = Object.keys(NOTIFICATION_SET_EVENT_LABELS);

export function CreateNotificationSetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [eventType, setEventType] = useState('');
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventType) {
      toast.error('Выберите тип события');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/admin/notification-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          name: name.trim() || undefined,
          isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      toast.success('Набор создан');
      onOpenChange(false);
      setEventType('');
      setName('');
      setIsDefault(false);
      router.refresh();
      if (data.set?.id) {
        router.push(`/portal/admin/notification-sets/${data.set.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать набор уведомлений</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="eventType">Тип события *</Label>
            <select
              id="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
            >
              <option value="">— Выберите —</option>
              {EVENT_TYPES.map((et) => (
                <option key={et} value={et}>
                  {NOTIFICATION_SET_EVENT_LABELS[et]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="name">Название (необязательно)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="По умолчанию — название типа события"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-[#E2E8F0]"
            />
            <Label htmlFor="isDefault" className="font-normal cursor-pointer">
              По умолчанию (прикреплять к новым курсам)
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Создание…' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
