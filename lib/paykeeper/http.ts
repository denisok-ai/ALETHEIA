/**
 * HTTP-слой PayKeeper: Basic Auth, кэш token (~23 ч), retry по сети, разбор result=fail и «HTML вместо JSON».
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { PayKeeperApiError, formatPayKeeperConnectionError } from '@/lib/paykeeper/errors';
import { parsePayKeeperToken } from '@/lib/paykeeper/token';

const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_NETWORK_RETRIES = 2;

type TokenEntry = { token: string; at: number };
const tokenByKey = new Map<string, TokenEntry>();

export function clearTokenCache(): void {
  tokenByKey.clear();
}

function cacheKey(cfg: PayKeeperConfig): string {
  return `${cfg.server}\0${cfg.login}`;
}

function basicAuthHeader(cfg: PayKeeperConfig): string {
  return `Basic ${Buffer.from(`${cfg.login}:${cfg.password}`).toString('base64')}`;
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<html');
}

/** Разбор тела ответа: выбрасывает PayKeeperApiError при result=fail или «не JSON». */
export function assertPayKeeperJsonOk(
  text: string,
  httpStatus: number,
  context: string
): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new PayKeeperApiError(`PayKeeper: пустой ответ (${context})`, httpStatus);
  }
  if (looksLikeHtml(trimmed)) {
    throw new PayKeeperApiError(
      'PayKeeper вернул HTML вместо JSON — проверьте логин, пароль и URL сервера.',
      httpStatus
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new PayKeeperApiError(
      `PayKeeper: ответ не JSON (${context}): ${trimmed.slice(0, 120)}`,
      httpStatus
    );
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const r = parsed as { result?: unknown; msg?: unknown };
    if (r.result === 'fail') {
      const msg = typeof r.msg === 'string' ? r.msg : 'result=fail';
      throw new PayKeeperApiError(msg, httpStatus);
    }
  }
  return parsed;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

function isRetryableNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const cause = e.cause as { code?: string } | undefined;
  const code = cause?.code || (e as { code?: string }).code;
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    e.name === 'AbortError'
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchPayKeeperToken(cfg: PayKeeperConfig): Promise<string> {
  const key = cacheKey(cfg);
  const hit = tokenByKey.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TOKEN_TTL_MS) {
    return hit.token;
  }

  const url = `https://${cfg.server}/info/settings/token/`;
  const { status, text } = await paykeeperRawFetch(cfg, url, { method: 'GET' });
  if (!status || status < 200 || status >= 300) {
    throw new PayKeeperApiError(
      `PayKeeper token HTTP ${status}: ${text.slice(0, 200)}`,
      status
    );
  }
  const token = parsePayKeeperToken(text);
  tokenByKey.set(key, { token, at: now });
  return token;
}

/** Принудительно обновить token (например после смены пароля). */
export async function refreshPayKeeperToken(cfg: PayKeeperConfig): Promise<string> {
  tokenByKey.delete(cacheKey(cfg));
  return fetchPayKeeperToken(cfg);
}

type RawFetchResult = { status: number; text: string };

async function paykeeperRawFetch(
  cfg: PayKeeperConfig,
  url: string,
  init: RequestInit
): Promise<RawFetchResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          ...init,
          headers: {
            ...init.headers,
            Authorization: basicAuthHeader(cfg),
          },
        },
        FETCH_TIMEOUT_MS
      );
      const text = await res.text();
      return { status: res.status, text };
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_NETWORK_RETRIES && isRetryableNetworkError(e)) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new Error(formatPayKeeperConnectionError(e, cfg.server), { cause: e });
    }
  }
  throw lastErr;
}

export type PaykeeperHttpOptions = {
  method: 'GET' | 'POST';
  /** Путь с ведущим слэшем, напр. /change/invoice/preview/ */
  path: string;
  /** Для GET — query string без '?'. */
  query?: string;
  /** Для POST — поля формы (token будет добавлен автоматически). */
  body?: URLSearchParams;
  /** Не добавлять token в POST (редкие методы). */
  skipToken?: boolean;
  /** Не проверять result=fail (для массивов ответов). */
  skipFailGuard?: boolean;
  logContext?: string;
};

/**
 * Унифицированный запрос к API PayKeeper.
 */
export async function paykeeperHttp(
  cfg: PayKeeperConfig,
  opts: PaykeeperHttpOptions
): Promise<{ status: number; text: string; json: unknown }> {
  const q = opts.query && opts.query.length ? `?${opts.query}` : '';
  const url = `https://${cfg.server}${opts.path}${q}`;
  const ctx = opts.logContext || opts.path;

  let bodyStr: string | undefined;
  let headers: Record<string, string> = {};

  if (opts.method === 'POST') {
    const form = opts.body ? new URLSearchParams(opts.body) : new URLSearchParams();
    if (!opts.skipToken) {
      const token = await fetchPayKeeperToken(cfg);
      form.set('token', token);
    }
    bodyStr = form.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const { status, text } = await paykeeperRawFetch(cfg, url, {
    method: opts.method,
    headers,
    body: bodyStr,
  });

  let json: unknown = null;
  const trimmed = text.trim();
  if (trimmed && !looksLikeHtml(trimmed)) {
    try {
      json = JSON.parse(trimmed);
    } catch {
      json = null;
    }
  }

  if (!opts.skipFailGuard && json && typeof json === 'object' && !Array.isArray(json)) {
    const r = json as { result?: unknown; msg?: unknown };
    if (r.result === 'fail') {
      const msg = typeof r.msg === 'string' ? r.msg : 'result=fail';
      throw new PayKeeperApiError(`${msg} (${ctx})`, status);
    }
  }

  return { status, text, json };
}
