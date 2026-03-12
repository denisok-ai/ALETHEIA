'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail } from 'lucide-react';

export function ProfileEditForm({
  initialDisplayName,
  email,
}: {
  initialDisplayName: string | null;
  email: string | null;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/portal/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Профиль обновлён');
    } catch {
      toast.error('Не удалось сохранить');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="portal-card p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
          <User className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium text-[var(--portal-text-muted)]">Email</p>
          <p className="text-sm font-medium text-[var(--portal-text)]">{email ?? '—'}</p>
          <p className="text-xs text-[var(--portal-text-soft)] mt-0.5">Изменить можно через администратора.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="displayName" className="text-sm font-medium text-[var(--portal-text)]">
          Имя для отображения
        </Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как к вам обращаться"
          className="mt-2 border-[#E2E8F0] focus:ring-[#6366F1] focus:border-[#6366F1]"
        />
      </div>

      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </Button>
    </form>
  );
}
