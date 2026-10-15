'use client';

/**
 * Кнопка «Обновить данные сейчас»: POST на /api/portal/admin/seo/sync, статус текстом рядом.
 * Модальных диалогов нет (alert/confirm не используем).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SeoSyncReport } from '@/lib/seo/sync';
import { SYNC_SOURCE_LABEL, SYNC_SOURCE_ORDER } from '@/lib/seo/dashboard';

type Status = { tone: 'idle' | 'busy' | 'ok' | 'error'; text: string };

function summarize(report: SeoSyncReport): string {
  return SYNC_SOURCE_ORDER.map((source) => {
    const s = report.sources[source];
    const label = SYNC_SOURCE_LABEL[source];
    if (s.state === 'ok') return `${label}: ${s.rows} строк`;
    if (s.state === 'not_configured') return `${label}: не настроен`;
    return `${label}: ошибка${s.message ? ` (${s.message})` : ''}`;
  }).join(' · ');
}

export function SeoSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: '' });
  const busy = status.tone === 'busy';

  async function run() {
    setStatus({ tone: 'busy', text: 'Синхронизирую за 7 дней, это может занять до минуты…' });
    try {
      const res = await fetch('/api/portal/admin/seo/sync', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { report?: SeoSyncReport; error?: string } | null;
      if (!res.ok || !data?.report) {
        setStatus({ tone: 'error', text: `Не удалось обновить: ${data?.error ?? `HTTP ${res.status}`}` });
        return;
      }
      setStatus({ tone: 'ok', text: summarize(data.report) });
      router.refresh();
    } catch {
      setStatus({ tone: 'error', text: 'Не удалось обновить: нет связи с сервером' });
    }
  }

  const color = status.tone === 'error' ? '#B91C1C' : 'var(--portal-text-muted)';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-[var(--portal-accent)] bg-[var(--portal-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Обновляю…' : 'Обновить данные сейчас'}
      </button>
      {status.text && (
        <p className="max-w-md text-right text-xs leading-snug" style={{ color }} role="status">
          {status.text}
        </p>
      )}
    </div>
  );
}
