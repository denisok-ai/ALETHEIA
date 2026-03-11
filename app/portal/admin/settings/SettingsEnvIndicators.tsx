'use client';

import { useState, useEffect } from 'react';

interface EnvCheck {
  RESEND_API_KEY?: boolean;
  TELEGRAM_BOT_TOKEN?: boolean;
  DEEPSEEK_API_KEY?: boolean;
  PAYKEEPER_SERVER?: boolean;
  NEXTAUTH_SECRET?: boolean;
  DATABASE_URL?: boolean;
  CRON_SECRET?: boolean;
}

export function SettingsEnvIndicators() {
  const [check, setCheck] = useState<EnvCheck | null>(null);

  useEffect(() => {
    fetch('/api/portal/admin/settings/env-check')
      .then(async (r) => {
        if (!r.ok) return {};
        return r.json();
      })
      .then(setCheck)
      .catch(() => setCheck({}));
  }, []);

  if (!check) return <p className="text-sm text-text-muted">Загрузка…</p>;

  const items: { key: string; label: string }[] = [
    { key: 'RESEND_API_KEY', label: 'Почта (Resend)' },
    { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram бот' },
    { key: 'DEEPSEEK_API_KEY', label: 'AI (DeepSeek)' },
    { key: 'PAYKEEPER_SERVER', label: 'PayKeeper' },
    { key: 'NEXTAUTH_SECRET', label: 'NextAuth секрет' },
    { key: 'DATABASE_URL', label: 'База данных' },
    { key: 'CRON_SECRET', label: 'Cron (рассылки)' },
  ];

  return (
    <ul className="mt-2 space-y-2 text-sm">
      {items.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-2">
          <span
            className={`inline-block h-3 w-3 shrink-0 rounded-full ${
              (check as Record<string, boolean>)[key] ? 'bg-green-500' : 'bg-red-400'
            }`}
            aria-hidden
          />
          <span className={ (check as Record<string, boolean>)[key] ? 'text-green-700' : 'text-red-700' }>
            {label}: {(check as Record<string, boolean>)[key] ? 'настроено' : 'не задано'}
          </span>
        </li>
      ))}
    </ul>
  );
}
