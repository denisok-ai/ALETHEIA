'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Check = { name: string; ok: boolean; detail?: string };

export function PaykeeperHealthClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    configured: boolean;
    server?: string;
    checks: Check[];
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/admin/paykeeper/health');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Ошибка');
      setData(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading && !data) {
    return <p className="text-sm text-[var(--portal-text-muted)]">Загрузка диагностики…</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
          Обновить
        </Button>
        {data.configured && data.server && (
          <span className="text-sm text-[var(--portal-text-muted)]">
            Сервер: <code className="rounded bg-[#F1F5F9] px-1">{data.server}</code>
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {data.checks.map((c) => (
          <li
            key={c.name}
            className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm"
          >
            <span className={c.ok ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
              {c.ok ? '✓' : '✗'} {c.name}
            </span>
            {c.detail && <p className="mt-1 text-[var(--portal-text-muted)]">{c.detail}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--portal-text-muted)]">
        Если DNS не резолвится из WSL, укажите корректный домен сервера PayKeeper из личного кабинета. Подробнее:{' '}
        <code className="rounded bg-[#F1F5F9] px-1">docs/PayKeeper-API-Map.md</code>.
      </p>
    </div>
  );
}
