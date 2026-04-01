'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Bot } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function CourseAiTutorToggle({
  courseId,
  initialEnabled,
}: {
  courseId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiTutorEnabled: !enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnabled(!enabled);
      toast.success(enabled ? 'AI-тьютор отключён для курса' : 'AI-тьютор включён для курса');
    } catch {
      toast.error('Ошибка сохранения');
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="text-lg font-semibold text-[var(--portal-text)] flex items-center gap-2">
        <Bot className="h-5 w-5 text-[var(--portal-accent)]" />
        AI-тьютор в плеере
      </h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Если включён, студенты видят кнопку чата с AI-тьютором при прохождении курса.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'Отключить AI-тьютор для курса' : 'Включить AI-тьютор для курса'}
          disabled={loading}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-2 disabled:opacity-50',
            enabled ? 'bg-[var(--portal-accent)]' : 'bg-[#E2E8F0]'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
              enabled ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </button>
        <Label className="text-sm font-medium text-[var(--portal-text)] cursor-pointer" onClick={handleToggle}>
          {enabled ? 'Включён' : 'Выключен'}
        </Label>
      </div>
    </div>
  );
}
