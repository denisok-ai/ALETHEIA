/**
 * Провижининг ящиков через Mailcow REST API (/api/v1/*).
 * Документация: https://docs.mailcow.email/
 */

import { getMailcowApiKey, getMailcowApiUrl } from '@/lib/mail-stack-env';

export type MailcowAddMailboxInput = {
  localPart: string;
  domain: string;
  password: string;
  /** Отображаемое имя в Mailcow */
  name: string;
};

export type MailcowApiResult =
  | { ok: true; raw: unknown; summary?: string }
  | { ok: false; error: string; httpStatus?: number; raw?: unknown };

/** Квота по умолчанию для ящиков @avaterra.pro (MiB, как в Mailcow UI / domain.defquota). */
export const MAILBOX_DEFAULT_QUOTA_MIB = '3072';

/**
 * Атрибуты протоколов и SOGo для edit/mailbox.
 * Без них Mailcow API add/mailbox оставляет attributes={} — в UI красные крестики,
 * SOGo может отдавать 401, хотя Dovecot IMAP/SMTP уже работает.
 */
export function mailcowDefaultMailboxAttr(): Record<string, string> {
  return {
    quota: MAILBOX_DEFAULT_QUOTA_MIB,
    force_pw_update: '0',
    force_tfa: '0',
    tls_enforce_in: '0',
    tls_enforce_out: '0',
    sogo_access: '1',
    imap_access: '1',
    pop3_access: '1',
    smtp_access: '1',
    sieve_access: '1',
    eas_access: '1',
    dav_access: '1',
    relayhost: '0',
    quarantine_notification: 'hourly',
    quarantine_category: 'reject',
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Mailcow API v1 часто отвечает HTTP 200 с телом-массивом вида
 * `[{ type: "success", ... }, { type: "danger", msg: "..." }]`.
 * Без этой проверки можно принять «успех», хотя ящик или пароль не применились.
 */
function mailcowV1BlockingError(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const t = typeof o.type === 'string' ? o.type.toLowerCase() : '';
    if (t !== 'danger' && t !== 'error') continue;
    const m = o.msg;
    let text = '';
    if (typeof m === 'string') text = m;
    else if (m && typeof m === 'object' && typeof (m as { text?: unknown }).text === 'string') {
      text = (m as { text: string }).text;
    } else if (m != null) {
      text = JSON.stringify(m).slice(0, 320);
    }
    const trimmed = text.trim();
    return trimmed || `Mailcow API (${t})`;
  }
  return null;
}

function summarizeMailcowPayload(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const m = (item as { msg?: unknown }).msg;
      if (typeof m === 'string' && m.trim()) parts.push(m.trim());
    }
    return parts.length ? parts.join('; ').slice(0, 300) : undefined;
  }
  if (typeof raw === 'object' && raw !== null && 'msg' in raw) {
    const m = (raw as { msg?: unknown }).msg;
    if (m == null) return undefined;
    return typeof m === 'string' ? m : JSON.stringify(m).slice(0, 200);
  }
  return undefined;
}

/**
 * Создаёт почтовый ящик в Mailcow.
 * Тело запроса соответствует типичному `add mailbox` в Mailcow API v1.
 */
export async function mailcowAddMailbox(input: MailcowAddMailboxInput): Promise<MailcowApiResult> {
  const base = getMailcowApiUrl();
  const key = getMailcowApiKey();
  if (!base || !key) {
    return {
      ok: false,
      error:
        'Не заданы MAILCOW_API_URL или MAILCOW_API_KEY в окружении процесса Next.js (см. docs/Mail-Server.md).',
    };
  }

  const url = `${stripTrailingSlash(base)}/api/v1/add/mailbox`;
  const body = {
    local_part: input.localPart,
    domain: input.domain,
    name: input.name,
    quota: MAILBOX_DEFAULT_QUOTA_MIB,
    password: input.password,
    password2: input.password,
    active: '1',
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Ошибка сети при обращении к Mailcow API',
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Mailcow HTTP ${res.status}`,
      httpStatus: res.status,
      raw,
    };
  }

  const block = mailcowV1BlockingError(raw);
  if (block) {
    return { ok: false, error: block, raw };
  }

  return { ok: true, raw, summary: summarizeMailcowPayload(raw) };
}

/**
 * Удаляет ящик в Mailcow (список полных адресов).
 */
export async function mailcowDeleteMailbox(fullEmail: string): Promise<MailcowApiResult> {
  const base = getMailcowApiUrl();
  const key = getMailcowApiKey();
  if (!base || !key) {
    return {
      ok: false,
      error: 'Не заданы MAILCOW_API_URL или MAILCOW_API_KEY.',
    };
  }

  const url = `${stripTrailingSlash(base)}/api/v1/delete/mailbox`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify([fullEmail.trim().toLowerCase()]),
    });
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      raw = null;
    }
    if (!res.ok) {
      return { ok: false, error: `Mailcow HTTP ${res.status}`, httpStatus: res.status, raw };
    }
    const block = mailcowV1BlockingError(raw);
    if (block) {
      return { ok: false, error: block, raw };
    }
    return { ok: true, raw };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Ошибка сети при удалении в Mailcow',
    };
  }
}

/**
 * Выставляет квоту, протоколы и SOGo через POST /api/v1/edit/mailbox.
 * Опционально обновляет пароль в том же запросе (как после add/mailbox).
 */
export async function mailcowApplyMailboxDefaults(
  fullEmail: string,
  options?: { password?: string }
): Promise<MailcowApiResult> {
  const base = getMailcowApiUrl();
  const key = getMailcowApiKey();
  if (!base || !key) {
    return {
      ok: false,
      error:
        'Не заданы MAILCOW_API_URL или MAILCOW_API_KEY в окружении процесса Next.js (см. docs/Mail-Server.md).',
    };
  }

  const attr: Record<string, string> = { ...mailcowDefaultMailboxAttr() };
  const password = options?.password?.trim();
  if (password) {
    attr.password = password;
    attr.password2 = password;
  }

  const url = `${stripTrailingSlash(base)}/api/v1/edit/mailbox`;
  const body = {
    items: [fullEmail.trim().toLowerCase()],
    attr,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Ошибка сети при обращении к Mailcow API',
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Mailcow HTTP ${res.status}`,
      httpStatus: res.status,
      raw,
    };
  }

  const block = mailcowV1BlockingError(raw);
  if (block) {
    return { ok: false, error: block, raw };
  }

  return { ok: true, raw, summary: summarizeMailcowPayload(raw) };
}

/**
 * Меняет пароль ящика в Mailcow (тот же формат, что и при создании).
 * Эндпоинт: POST /api/v1/edit/mailbox
 */
export async function mailcowEditMailboxPassword(
  fullEmail: string,
  password: string
): Promise<MailcowApiResult> {
  return mailcowApplyMailboxDefaults(fullEmail, { password });
}
