/**
 * HTTP-слой PayKeeper: Basic Auth, токен безопасности, retry по сети,
 * разбор result=fail и «HTML вместо JSON».
 *
 * ## Политика токена безопасности (docs.paykeeper.ru → «Токен безопасности»)
 *
 * PayKeeper требует: перед каждым POST, изменяющим данные, получить токен через
 * GET /info/settings/token/ и **сразу** передать его в теле запроса. Токен
 * ротируется раз в 24 ч по расписанию PayKeeper (не привязано к нашему GET).
 *
 * Мы **не кэшируем** токен между операциями — никакого TTL (ни 23 ч, ни 5 мин):
 * каждый POST-with-token выполняет свежий GET непосредственно перед отправкой.
 *
 * Конкурентный контроль (не «угадывание срока жизни»):
 *  1) in-flight dedup (`tokenInflightByKey`) — параллельные GET на один server+login
 *     делят один HTTP-запрос, чтобы не создавать thundering herd;
 *  2) сериализация POST-with-token (`postOpTailByKey`) — GET→POST одной операции
 *     не перемежается с другой: иначе новый GET может инвалидировать только что
 *     полученный токен соседней операции (инцидент 22.07.2026, 3 счёта за минуту).
 *
 * Retry при «токен не верен» — defense-in-depth на случай редкой ротации PayKeeper
 * между нашим GET и POST; один повтор с forceRefresh, без циклов.
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { PayKeeperApiError, formatPayKeeperConnectionError } from '@/lib/paykeeper/errors';
import { parsePayKeeperToken } from '@/lib/paykeeper/token';

/**
 * Бюджет на весь цикл (таймаут × попытки + паузы) должен укладываться в
 * proxy_read_timeout nginx (60s): иначе клиент видит вечное «создание платежа»
 * и обрыв соединения вместо внятной ошибки (инцидент 16.07.2026).
 * 12s × 2 попытки + 0.4s ≈ 25s максимум.
 */
const FETCH_TIMEOUT_MS = 12_000;
const MAX_NETWORK_RETRIES = 1;

/** In-flight GET /info/settings/token/ по ключу server+login. */
const tokenInflightByKey = new Map<string, Promise<string>>();
/** Очередь POST-with-token: сериализация GET→POST на один server+login. */
const postOpTailByKey = new Map<string, Promise<unknown>>();

export function clearTokenCache(): void {
  tokenInflightByKey.clear();
  postOpTailByKey.clear();
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

async function fetchTokenFromPayKeeper(cfg: PayKeeperConfig): Promise<string> {
  const url = `https://${cfg.server}/info/settings/token/`;
  const { status, text } = await paykeeperRawFetch(cfg, url, { method: 'GET' });
  if (!status || status < 200 || status >= 300) {
    throw new PayKeeperApiError(
      `PayKeeper token HTTP ${status}: ${text.slice(0, 200)}`,
      status
    );
  }
  return parsePayKeeperToken(text);
}

export type AcquirePayKeeperTokenOptions = {
  /** Новый GET, без переиспользования in-flight dedup (после ошибки «токен не верен»). */
  forceRefresh?: boolean;
};

/**
 * Получить токен безопасности PayKeeper для одной mutating-операции.
 * Всегда обращается к GET /info/settings/token/ (результат не сохраняется между вызовами).
 * In-flight dedup только для параллельных GET на тот же server+login.
 */
export async function acquirePayKeeperToken(
  cfg: PayKeeperConfig,
  opts?: AcquirePayKeeperTokenOptions
): Promise<string> {
  const key = cacheKey(cfg);

  if (!opts?.forceRefresh) {
    const inflight = tokenInflightByKey.get(key);
    if (inflight) return inflight;
  } else {
    tokenInflightByKey.delete(key);
  }

  const p = fetchTokenFromPayKeeper(cfg).finally(() => {
    if (tokenInflightByKey.get(key) === p) {
      tokenInflightByKey.delete(key);
    }
  });

  tokenInflightByKey.set(key, p);
  return p;
}

/** @deprecated Используйте acquirePayKeeperToken — семантика та же (свежий GET, in-flight dedup). */
export async function fetchPayKeeperToken(cfg: PayKeeperConfig): Promise<string> {
  return acquirePayKeeperToken(cfg);
}

/** Принудительный новый GET (например после смены пароля или ошибки «токен не верен»). */
export async function refreshPayKeeperToken(cfg: PayKeeperConfig): Promise<string> {
  return acquirePayKeeperToken(cfg, { forceRefresh: true });
}

/**
 * Сериализует POST-with-token на один server+login: GET→POST не перемежается
 * с другой операцией, чтобы параллельные счета не инвалидировали токены друг друга.
 */
function runSerializedPostOp<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = postOpTailByKey.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  postOpTailByKey.set(key, run);
  return run.finally(() => {
    if (postOpTailByKey.get(key) === run) {
      postOpTailByKey.delete(key);
    }
  });
}

/**
 * Признак ответа PayKeeper «токен безопасности не верен/устарел».
 * Матчим устойчиво и без регистра: рус. «Токен … не верен/устарел/недействителен»
 * и англ. «token invalid/expired/not valid».
 */
export function isTokenInvalidFail(json: unknown): boolean {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
  const r = json as { result?: unknown; msg?: unknown };
  if (r.result !== 'fail') return false;
  const msg = (typeof r.msg === 'string' ? r.msg : '').toLowerCase();
  const ruToken = /токен/.test(msg) && /(не\s*вер|невер|устар|недейств|неправильн|инвал)/.test(msg);
  const enToken = /token/.test(msg) && /(invalid|expired|not\s*valid|incorrect|wrong)/.test(msg);
  return ruToken || enToken;
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

async function paykeeperHttpOnce(
  cfg: PayKeeperConfig,
  opts: PaykeeperHttpOptions,
  forceFreshToken: boolean
): Promise<{ status: number; text: string; json: unknown }> {
  const q = opts.query && opts.query.length ? `?${opts.query}` : '';
  const url = `https://${cfg.server}${opts.path}${q}`;

  let bodyStr: string | undefined;
  const headers: Record<string, string> = {};

  if (opts.method === 'POST') {
    const form = opts.body ? new URLSearchParams(opts.body) : new URLSearchParams();
    if (!opts.skipToken) {
      const token = await acquirePayKeeperToken(
        cfg,
        forceFreshToken ? { forceRefresh: true } : undefined
      );
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
  return { status, text, json };
}

/**
 * Унифицированный запрос к API PayKeeper.
 */
export async function paykeeperHttp(
  cfg: PayKeeperConfig,
  opts: PaykeeperHttpOptions
): Promise<{ status: number; text: string; json: unknown }> {
  const ctx = opts.logContext || opts.path;
  const usesToken = opts.method === 'POST' && !opts.skipToken;

  const execute = async (): Promise<{ status: number; text: string; json: unknown }> => {
    let res = await paykeeperHttpOnce(cfg, opts, false);

    // Defense-in-depth: PayKeeper мог провернуть токен между GET и POST (редко).
    if (usesToken && isTokenInvalidFail(res.json)) {
      res = await paykeeperHttpOnce(cfg, opts, true);
    }

    if (!opts.skipFailGuard && res.json && typeof res.json === 'object' && !Array.isArray(res.json)) {
      const r = res.json as { result?: unknown; msg?: unknown };
      if (r.result === 'fail') {
        const msg = typeof r.msg === 'string' ? r.msg : 'result=fail';
        throw new PayKeeperApiError(`${msg} (${ctx})`, res.status);
      }
    }

    return res;
  };

  if (usesToken) {
    return runSerializedPostOp(cacheKey(cfg), execute);
  }
  return execute();
}
