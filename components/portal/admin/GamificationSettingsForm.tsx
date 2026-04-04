'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function GamificationSettingsForm() {
  const [xpPerLevel, setXpPerLevel] = useState(100);
  const [xpLessonComplete, setXpLessonComplete] = useState(25);
  const [defaults, setDefaults] = useState({ xpPerLevel: 100, xpLessonComplete: 25 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/admin/gamification-settings', { credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setXpPerLevel(data.xpPerLevel);
        setXpLessonComplete(data.xpLessonComplete);
        if (data.defaults) setDefaults(data.defaults);
      } catch {
        if (!cancelled) setMessage('Не удалось загрузить настройки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/portal/admin/gamification-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xpPerLevel, xpLessonComplete }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? 'Ошибка сохранения');
        return;
      }
      setMessage('Сохранено');
    } catch {
      setMessage('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="gamification-charge-per-level" className="block text-sm font-medium text-[var(--portal-text)]">
          Единиц заряда на один уровень
        </label>
        <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
          Определяет шаг «Уровень заряда»: номер = ⌊накопленный заряд / этот шаг⌋ + 1. На дашборде: текст про то, что шкала
          пополняется каждые N единиц; процент «Заряд: …%» — доля внутри текущего сегмента. По умолчанию:{' '}
          {defaults.xpPerLevel}.
        </p>
        <input
          id="gamification-charge-per-level"
          type="number"
          min={1}
          max={1_000_000}
          className="mt-1 w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
          value={xpPerLevel}
          onChange={(e) => setXpPerLevel(Number(e.target.value))}
        />
      </div>
      <div>
        <label htmlFor="gamification-charge-lesson" className="block text-sm font-medium text-[var(--portal-text)]">
          Прирост заряда за первое завершение урока
        </label>
        <p className="text-xs text-[var(--portal-text-muted)] mt-0.5">
          Начисляется один раз при первом переводе урока в «завершён» в SCORM. На дашборде студента в приветствии
          фигурирует формулировка вроде «+{xpLessonComplete} к уровню заряда» (после сохранения подставляется выбранное
          значение). Повторные сохранения прогресса не добавляют заряд повторно. По умолчанию: {defaults.xpLessonComplete}.
        </p>
        <input
          id="gamification-charge-lesson"
          type="number"
          min={0}
          max={100_000}
          className="mt-1 w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
          value={xpLessonComplete}
          onChange={(e) => setXpLessonComplete(Number(e.target.value))}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </Button>
      {message && <p className="text-sm text-[var(--portal-text-muted)]">{message}</p>}
    </form>
  );
}
