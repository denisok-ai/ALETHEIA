'use client';

/**
 * Форма редактирования набора уведомлений: название, по умолчанию, активен, шаблон.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/portal/Card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TemplateOption {
  id: string;
  name: string;
}

interface NotificationSetEditFormProps {
  setId: string;
  initial: {
    name: string;
    isDefault: boolean;
    isActive: boolean;
    templateId: string | null;
  };
}

export function NotificationSetEditForm({ setId, initial }: NotificationSetEditFormProps) {
  const [name, setName] = useState(initial.name);
  const [isDefault, setIsDefault] = useState(initial.isDefault);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [templateId, setTemplateId] = useState(initial.templateId ?? '');
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/portal/admin/notification-templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`/api/portal/admin/notification-sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          isDefault,
          isActive,
          templateId: templateId.trim() || null,
        }),
      });
      if (r.ok) {
        // refresh to show updated data
        window.location.reload();
      } else {
        const d = await r.json();
        alert(d.error || 'Ошибка сохранения');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="ns-name">Название</Label>
          <Input
            id="ns-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ns-template">Шаблон уведомления</Label>
          <select
            id="ns-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--portal-accent)]"
          >
            <option value="">— Без шаблона (использовать стандартный) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
            Шаблоны создаются в разделе «Шаблоны уведомлений». Если шаблон не выбран, используется стандартный текст.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-[#E2E8F0]"
            />
            <span className="text-sm">По умолчанию (прикреплять к новым курсам)</span>
          </label>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-[#E2E8F0]"
            />
            <span className="text-sm">Активен</span>
          </label>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Link href="/portal/admin/notification-sets" className={cn(buttonVariants({ variant: 'secondary' }))}>
            К каталогу
          </Link>
        </div>
      </form>
    </Card>
  );
}
