'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4 rounded-xl border border-border bg-white p-6">
      <div>
        <Label className="text-sm font-medium text-text-muted">Email</Label>
        <p className="mt-1 text-dark">{email ?? '—'}</p>
        <p className="mt-0.5 text-xs text-text-muted">Изменить email можно через администратора.</p>
      </div>
      <div>
        <Label htmlFor="displayName">Имя для отображения</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как к вам обращаться"
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </Button>
    </form>
  );
}
