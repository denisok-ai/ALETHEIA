'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/portal/Card';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';

export function TicketAutoReplyBlock() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/portal/admin/ai-settings/ticket-auto-reply')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.enabled === 'boolean') setEnabled(d.enabled);
      })
      .catch(() => toast.error('Не удалось загрузить настройку'))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(checked: boolean) {
    setSaving(true);
    try {
      const res = await fetch('/api/portal/admin/ai-settings/ticket-auto-reply', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error('Ошибка');
      setEnabled(checked);
      toast.success(checked ? 'Автоответ при создании обращения включён' : 'Автоответ отключён');
    } catch {
      toast.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Автоответ при создании обращения"
      description="При включении для новых обращений в поддержку AI попытается сформировать краткий ответ по базе знаний. Если ответ «уверенный», он сохраняется как первое сообщение от поддержки и отправляется студенту на email; иначе тикет остаётся без автоответа."
    >
      {loading ? (
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      ) : (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="ticket-auto-reply"
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="h-4 w-4 rounded border-[#E2E8F0] text-[#6366F1] focus:ring-[#6366F1]"
          />
          <Label htmlFor="ticket-auto-reply" className="text-sm font-medium text-[var(--portal-text)] cursor-pointer flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--portal-text-muted)]" />
            Включить автоответ при создании тикета
          </Label>
        </div>
      )}
    </Card>
  );
}
