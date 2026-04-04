'use client';

/**
 * Админ: заряд пользователя (UserEnergy), корректировка и журнал из AuditLog.
 */
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChargeBatteryGauge } from '@/components/portal/ChargeBatteryGauge';
import { Card } from '@/components/portal/Card';
import { Button } from '@/components/ui/button';
import { gamificationSourceLabelRu } from '@/lib/gamification-source-labels';

type BadgeRow = { minXp: number; label: string; emoji: string };

type HistoryRow = {
  id: number;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  oldXp: number | null;
  newXp: number | null;
  delta: number | null;
  note: string | null;
};

type GamificationEventRow = {
  id: string;
  source: string;
  delta: number;
  balanceAfter: number;
  meta: Record<string, unknown>;
  createdAt: string;
  /** Подпись курса: из meta или из справочника Course по meta.courseId */
  courseTitle?: string | null;
};

type EnergyPayload = {
  userId: string;
  xp: number;
  level: number;
  chargePercent: number;
  xpPerLevel: number;
  xpLessonComplete: number;
  xpVerificationApproved: number;
  lastPracticeAt: string | null;
  updatedAt: string | null;
  badges: BadgeRow[];
  history: HistoryRow[];
  gamificationEvents?: GamificationEventRow[];
};

export function UserEnergyAdminBlock({ userId, profileRole }: { userId: string; profileRole: string }) {
  const [data, setData] = useState<EnergyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deltaValue, setDeltaValue] = useState('');
  const [deltaNote, setDeltaNote] = useState('');
  const [setValue, setSetValue] = useState('');
  const [setNote, setSetNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}/energy`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Ошибка ${res.status}`);
      }
      const json = (await res.json()) as EnergyPayload;
      setData({
        ...json,
        xpVerificationApproved: json.xpVerificationApproved ?? 0,
        gamificationEvents: json.gamificationEvents ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchBody(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}/energy`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? 'Ошибка сохранения');
        return;
      }
      await load();
      setDeltaValue('');
      setDeltaNote('');
      setSetValue('');
      setSetNote('');
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }

  function onDeltaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(deltaValue);
    if (!Number.isFinite(n) || n === 0) {
      setError('Введите ненулевое целое число (начисление или списание).');
      return;
    }
    void patchBody({
      mode: 'delta',
      value: Math.trunc(n),
      note: deltaNote.trim() || undefined,
    });
  }

  function onSetSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(setValue);
    if (!Number.isFinite(n) || n < 0) {
      setError('Введите неотрицательное число.');
      return;
    }
    const rounded = Math.round(n);
    if (
      !window.confirm(
        `Установить накопленный заряд ровно ${rounded} ед.? Текущее значение будет заменено.`
      )
    ) {
      return;
    }
    void patchBody({
      mode: 'set',
      value: rounded,
      note: setNote.trim() || undefined,
    });
  }

  if (loading) {
    return <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>;
  }

  if (error && !data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          Повторить
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const xpProgressRaw = data.xpPerLevel >= 1 ? ((data.xp % data.xpPerLevel) / data.xpPerLevel) * 100 : 0;

  return (
    <div className="space-y-6">
      {profileRole !== 'user' && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Роль «{profileRole}»: автоматическое начисление заряда в SCORM обычно относится к студентам (роль user). Ручная
          корректировка ниже доступна для любой учётной записи.
        </p>
      )}

      <Card title="Текущие показатели" description="Согласовано с дашбордом студента и настройками геймификации.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <p className="text-[var(--portal-text-muted)]">Накопленный заряд</p>
            <p className="text-lg font-semibold text-[var(--portal-text)]">{data.xp} ед.</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">Уровень заряда</p>
            <p className="text-lg font-semibold text-[var(--portal-text)]">{data.level}</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">Заряд в сегменте</p>
            <p className="text-lg font-semibold text-[var(--portal-text)]">{data.chargePercent}%</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">Шаг уровня (из настроек)</p>
            <p className="font-medium text-[var(--portal-text)]">{data.xpPerLevel} ед.</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">Прирост за урок (справка)</p>
            <p className="font-medium text-[var(--portal-text)]">+{data.xpLessonComplete} ед.</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">За одобр. верификацию (справка)</p>
            <p className="font-medium text-[var(--portal-text)]">+{data.xpVerificationApproved} ед.</p>
          </div>
          <div>
            <p className="text-[var(--portal-text-muted)]">Последняя активность (SCORM)</p>
            <p className="font-medium text-[var(--portal-text)]">
              {data.lastPracticeAt
                ? format(new Date(data.lastPracticeAt), 'd MMM yyyy, HH:mm', { locale: ru })
                : '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 max-w-xs">
          <p className="text-xs text-[var(--portal-text-muted)] mb-1">Шкала</p>
          <ChargeBatteryGauge percent={xpProgressRaw} />
        </div>

        {data.badges.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-[var(--portal-text-muted)] mb-2">Бейджи</p>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b) => (
                <span
                  key={b.minXp}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-accent-muted)]
                    bg-[var(--portal-accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--portal-accent-dark)]"
                >
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="События заряда"
        description="Уроки (SCORM), одобренные задания, ручные правки — для проверки данных на проде."
      >
        {!data.gamificationEvents || data.gamificationEvents.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Записей пока нет (или миграция журнала не применена).</p>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[var(--portal-text-muted)]">
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Источник</th>
                  <th className="py-2 pr-2 font-medium text-right">Δ</th>
                  <th className="py-2 pr-2 font-medium text-right">Баланс</th>
                  <th className="py-2 font-medium">Контекст</th>
                </tr>
              </thead>
              <tbody>
                {data.gamificationEvents.map((ev) => {
                  const title =
                    (ev.courseTitle && String(ev.courseTitle).trim()) ||
                    (typeof ev.meta.courseTitle === 'string' && ev.meta.courseTitle
                      ? ev.meta.courseTitle
                      : ev.source === 'verification_approved'
                        ? 'Домашнее задание'
                        : '—');
                  return (
                    <tr key={ev.id} className="border-b border-[#F1F5F9]">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs">
                        {format(new Date(ev.createdAt), 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="py-2 pr-3">{gamificationSourceLabelRu(ev.source)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{ev.balanceAfter}</td>
                      <td className="py-2 text-xs text-[var(--portal-text-muted)] max-w-[14rem] truncate" title={title}>
                        {title}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Корректировка" description="Начисление или списание единиц заряда; либо жёсткая установка значения.">
        {error && data && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <form onSubmit={onDeltaSubmit} className="space-y-3 max-w-md border-b border-[#E2E8F0] pb-6 mb-6">
          <p className="text-sm font-medium text-[var(--portal-text)]">Начислить или списать</p>
          <p className="text-xs text-[var(--portal-text-muted)]">
            Отрицательное число уменьшает заряд (не ниже нуля). Например: +15 или −10.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[8rem]">
              <label htmlFor="energy-delta" className="sr-only">
                Изменение
              </label>
              <input
                id="energy-delta"
                type="number"
                className="w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
                value={deltaValue}
                onChange={(e) => setDeltaValue(e.target.value)}
                placeholder="±число"
                disabled={saving}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? '…' : 'Применить'}
            </Button>
          </div>
          <div>
            <label htmlFor="energy-delta-note" className="block text-xs text-[var(--portal-text-muted)]">
              Комментарий (необязательно)
            </label>
            <input
              id="energy-delta-note"
              type="text"
              className="mt-1 w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
              value={deltaNote}
              onChange={(e) => setDeltaNote(e.target.value)}
              maxLength={500}
              disabled={saving}
            />
          </div>
        </form>

        <form onSubmit={onSetSubmit} className="space-y-3 max-w-md">
          <p className="text-sm font-medium text-[var(--portal-text)]">Установить заряд</p>
          <p className="text-xs text-[var(--portal-text-muted)]">
            Задаёт точное значение накопленного заряда (ед.); уровень пересчитается автоматически.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[8rem]">
              <label htmlFor="energy-set" className="sr-only">
                Новое значение
              </label>
              <input
                id="energy-set"
                type="number"
                min={0}
                className="w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
                value={setValue}
                onChange={(e) => setSetValue(e.target.value)}
                placeholder="0 …"
                disabled={saving}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? '…' : 'Установить'}
            </Button>
          </div>
          <div>
            <label htmlFor="energy-set-note" className="block text-xs text-[var(--portal-text-muted)]">
              Комментарий (необязательно)
            </label>
            <input
              id="energy-set-note"
              type="text"
              className="mt-1 w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-sm"
              value={setNote}
              onChange={(e) => setSetNote(e.target.value)}
              maxLength={500}
              disabled={saving}
            />
          </div>
        </form>
      </Card>

      <Card title="Журнал ручных правок (аудит)" description="Только изменения через форму выше; полный поток — в «События заряда».">
        {data.history.length === 0 ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Пока нет ручных изменений.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[var(--portal-text-muted)]">
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Кто</th>
                  <th className="py-2 pr-2 font-medium text-right">Было</th>
                  <th className="py-2 pr-2 font-medium text-right">Стало</th>
                  <th className="py-2 pr-2 font-medium text-right">Δ</th>
                  <th className="py-2 font-medium">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id} className="border-b border-[#F1F5F9]">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {format(new Date(h.createdAt), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="py-2 pr-3 text-[var(--portal-text-muted)] max-w-[12rem] truncate" title={h.actorEmail ?? h.actorId ?? ''}>
                      {h.actorEmail ?? h.actorId ?? '—'}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{h.oldXp ?? '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{h.newXp ?? '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {h.delta != null ? (h.delta > 0 ? `+${h.delta}` : String(h.delta)) : '—'}
                    </td>
                    <td className="py-2 text-[var(--portal-text-muted)] max-w-xs truncate" title={h.note ?? ''}>
                      {h.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
