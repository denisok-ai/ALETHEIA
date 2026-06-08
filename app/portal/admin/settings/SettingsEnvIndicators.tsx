'use client';

import { useState, useEffect } from 'react';

interface EnvCheck {
  RESEND_API_KEY?: boolean;
  SMTP_CONFIGURED?: boolean;
  MAIL_OUTBOUND_OK?: boolean;
  TELEGRAM_BOT_TOKEN?: boolean;
  /** Тот же резолв ключа, что у /api/chat (Настройки AI + ключи из «Переменные окружения»). */
  CHATBOT_LLM_READY?: boolean;
  DEEPSEEK_API_KEY?: boolean;
  OPENAI_API_KEY?: boolean;
  PAYKEEPER_SERVER?: boolean;
  NEXTAUTH_SECRET?: boolean;
  DATABASE_URL?: boolean;
  CRON_SECRET?: boolean;
  /** Сервер ответил 403 — сессия не прошла (часто после неверного NEXTAUTH_URL в БД). */
  accessDenied?: boolean;
  /** Ошибка при сборе проверок (редко); не путать с «интеграции не настроены». */
  loadError?: string;
  error?: string;
}

export function SettingsEnvIndicators() {
  const [check, setCheck] = useState<EnvCheck | null>(null);

  useEffect(() => {
    fetch('/api/portal/admin/settings/env-check', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 403 || r.status === 401) {
          return { accessDenied: true } as EnvCheck;
        }
        let data: EnvCheck = {};
        try {
          data = (await r.json()) as EnvCheck & { error?: string };
        } catch {
          return { loadError: `Ответ сервера не JSON (HTTP ${r.status})` };
        }
        if (!r.ok) {
          return { ...data, loadError: data.loadError || data.error || `HTTP ${r.status}` };
        }
        return data;
      })
      .then(setCheck)
      .catch(() => setCheck({ loadError: 'Сеть или неизвестная ошибка' }));
  }, []);

  if (!check) return <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>;

  if (check.accessDenied) {
    return (
      <p className="mt-2 text-sm text-red-700">
        Проверка интеграций недоступна (нет сессии администратора). Частая причина после смены{' '}
        <code className="rounded bg-[#F1F5F9] px-1">NEXTAUTH_URL</code> в БД на неверный адрес: NextAuth перестаёт
        принимать cookie. Выйдите из портала и войдите снова; если в БД записан localhost на продакшене — после
        обновления приложения такой URL игнорируется в пользу <code className="rounded bg-[#F1F5F9] px-1">site_url</code> / .env.
      </p>
    );
  }

  if (check.loadError) {
    return (
      <div className="mt-2 space-y-2 text-sm">
        <p className="text-red-700">
          Не удалось загрузить состояние интеграций: {check.loadError}. Это не значит, что все сервисы отключены —
          проверьте логи сервера и доступ к БД.
        </p>
      </div>
    );
  }

  const items: { key: string; label: string }[] = [
    { key: 'MAIL_OUTBOUND_OK', label: 'Исходящая почта (Resend или SMTP)' },
    { key: 'RESEND_API_KEY', label: 'Resend API (если используете)' },
    { key: 'SMTP_CONFIGURED', label: 'SMTP (если используете)' },
    { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram бот' },
    { key: 'CHATBOT_LLM_READY', label: 'Чат консультанта (LLM ключ)' },
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
