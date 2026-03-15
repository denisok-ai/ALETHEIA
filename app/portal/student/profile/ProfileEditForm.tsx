'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { profilePatchSchema } from '@/lib/validations/profile';

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
    const parsed = profilePatchSchema.safeParse({ displayName: displayName.trim() || null });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Проверьте данные');
      return;
    }
    const trimmed = parsed.data.displayName === '' || parsed.data.displayName === null ? '' : String(parsed.data.displayName).trim();
    setSaving(true);
    try {
      const r = await fetch('/api/portal/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed === '' ? null : trimmed }),
      });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Профиль обновлён');
    } catch {
      toast.error('Не удалось сохранить');
    }
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 w-full max-w-5xl">
      {/* Карточка с email — слева на десктопе */}
      <div className="portal-card p-4 md:p-5 lg:col-span-4 xl:col-span-3 h-fit">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <User className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">Email</p>
            <p className="text-sm font-medium text-[var(--portal-text)] truncate" title={email ?? undefined}>{email ?? '—'}</p>
            <p className="text-xs text-[var(--portal-text-soft)] mt-0.5">Изменить можно через администратора.</p>
          </div>
        </div>
      </div>

      {/* Форма редактирования */}
      <form onSubmit={handleSubmit} className="portal-card p-4 md:p-6 lg:col-span-8 xl:col-span-9 space-y-4 md:space-y-5">
        <div>
          <Label htmlFor="displayName" className="text-sm font-medium text-[var(--portal-text)]">
            Имя для отображения
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Как к вам обращаться"
            maxLength={200}
            className="mt-2 border-[#E2E8F0] focus:ring-[#6366F1] focus:border-[#6366F1] min-h-10 touch-manipulation"
          />
          <p className="mt-1 text-xs text-[var(--portal-text-muted)]">До 200 символов</p>
        </div>
        <Button type="submit" variant="primary" disabled={saving} className="min-h-10 touch-manipulation">
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </form>
    </div>
  );
}
