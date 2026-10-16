'use client';

/**
 * Действия страницы «Соцсети»: пауза всех сетей, вкл/выкл сети, действия над постом.
 * Каждое действие — POST в /api/portal/admin/social/*, статус текстом рядом с кнопкой.
 * Модальных диалогов нет (alert/confirm не используем). После успеха — router.refresh().
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = { tone: 'idle' | 'busy' | 'ok' | 'error'; text: string };

async function postJson(url: string, body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'нет связи с сервером' };
  }
}

function StatusLine({ status }: { status: Status }) {
  if (!status.text) return null;
  const color = status.tone === 'error' ? '#B91C1C' : 'var(--portal-text-muted)';
  return (
    <p className="max-w-xs text-right text-xs leading-snug" style={{ color }} role="status">
      {status.text}
    </p>
  );
}

const buttonClass =
  'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60';
const primaryStyle = {
  borderColor: 'var(--portal-accent)',
  background: 'var(--portal-accent)',
  color: '#fff',
};
const secondaryStyle = {
  borderColor: 'var(--portal-border, #E2E8F0)',
  background: 'var(--portal-surface, #fff)',
  color: 'var(--portal-text)',
};

export function PauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: '' });
  const busy = status.tone === 'busy';

  async function run() {
    const next = !paused;
    setStatus({ tone: 'busy', text: 'Сохраняю…' });
    const res = await postJson('/api/portal/admin/social/pause', { paused: next });
    if (!res.ok) {
      setStatus({ tone: 'error', text: `Не удалось изменить паузу: ${res.error}` });
      return;
    }
    setStatus({ tone: 'ok', text: next ? 'Пауза включена.' : 'Пауза снята.' });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={buttonClass}
        style={paused ? primaryStyle : secondaryStyle}
      >
        {paused ? 'Снять паузу' : 'Пауза всех сетей'}
      </button>
      <StatusLine status={status} />
    </div>
  );
}

export function NetworkToggle({ code, enabled }: { code: string; enabled: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: '' });
  const busy = status.tone === 'busy';

  async function run() {
    const next = !enabled;
    setStatus({ tone: 'busy', text: 'Сохраняю…' });
    const res = await postJson(`/api/portal/admin/social/networks/${encodeURIComponent(code)}`, { enabled: next });
    if (!res.ok) {
      setStatus({ tone: 'error', text: `Не удалось: ${res.error}` });
      return;
    }
    setStatus({
      tone: 'ok',
      text: next ? 'Сеть включена: счётчик ошибок сброшен.' : 'Сеть выключена.',
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={busy} className={buttonClass} style={secondaryStyle}>
        {enabled ? 'Выключить' : 'Включить'}
      </button>
      <StatusLine status={status} />
    </div>
  );
}

/**
 * Действия над постом. failed → «Вернуть в очередь»; scheduled → «Пропустить» и «Перенести».
 * scheduledInput — текущее время поста в формате datetime-local (МСК), подставляется в поле переноса.
 */
export function PostActions({
  id,
  status: postStatus,
  scheduledInput,
}: {
  id: number;
  status: string;
  scheduledInput: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: '' });
  const [when, setWhen] = useState(scheduledInput);
  const busy = status.tone === 'busy';

  async function act(body: { action: 'requeue' | 'skip' | 'reschedule'; scheduledAt?: string }, okText: string) {
    setStatus({ tone: 'busy', text: 'Сохраняю…' });
    const res = await postJson(`/api/portal/admin/social/posts/${id}`, body);
    if (!res.ok) {
      setStatus({ tone: 'error', text: `Не удалось: ${res.error}` });
      return;
    }
    setStatus({ tone: 'ok', text: okText });
    router.refresh();
  }

  if (postStatus === 'failed') {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: 'requeue' }, 'Пост возвращён в очередь.')}
          className={buttonClass}
          style={secondaryStyle}
        >
          Вернуть в очередь
        </button>
        <p className="max-w-xs text-xs leading-snug" style={{ color: 'var(--portal-text-muted)' }}>
          Сначала проверьте канал: если пост уже вышел, повтор создаст дубль.
        </p>
        <StatusLine status={status} />
      </div>
    );
  }

  if (postStatus === 'scheduled') {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ action: 'skip' }, 'Пост пропущен.')}
          className={buttonClass}
          style={secondaryStyle}
        >
          Пропустить
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            aria-label="Новое время поста, МСК"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-lg border px-2 py-1 text-sm"
            style={secondaryStyle}
          />
          <button
            type="button"
            disabled={busy || !when}
            onClick={() => act({ action: 'reschedule', scheduledAt: when }, 'Время поста изменено.')}
            className={buttonClass}
            style={secondaryStyle}
          >
            Перенести
          </button>
        </div>
        <StatusLine status={status} />
      </div>
    );
  }

  return null;
}
