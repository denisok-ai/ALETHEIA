/**
 * HTTP-клиент ЮKassa API v3: HTTP Basic (shopId:secretKey), таймаут, Idempotence-Key.
 * Ошибки не содержат секретов: в сообщение попадает только description/code из ответа API.
 */

export const YOOKASSA_API_BASE = 'https://api.yookassa.ru/v3';
const REQUEST_TIMEOUT_MS = 10_000;

export class YooKassaApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'YooKassaApiError';
    this.status = status;
    this.code = code;
  }
}

export type YooKassaCredentials = { shopId: string; secretKey: string };

export type YooKassaRequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** Обязателен для POST (ЮKassa: повтор с тем же ключом не создаёт дубль). */
  idempotenceKey?: string;
  fetchImpl?: typeof fetch;
};

export function basicAuthHeader(creds: YooKassaCredentials): string {
  return `Basic ${Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString('base64')}`;
}

function errorMessageFromBody(parsed: unknown, status: number): { message: string; code?: string } {
  if (parsed && typeof parsed === 'object') {
    const o = parsed as { code?: unknown; description?: unknown };
    const code = typeof o.code === 'string' ? o.code : undefined;
    const description = typeof o.description === 'string' ? o.description : '';
    const detail = [code, description].filter(Boolean).join(': ').slice(0, 300);
    return { message: `ЮKassa HTTP ${status}${detail ? `: ${detail}` : ''}`, code };
  }
  return { message: `ЮKassa HTTP ${status}` };
}

/**
 * Один запрос к API. Сетевой сбой (не HTTP-ошибка) повторяем один раз: для POST это
 * безопасно благодаря Idempotence-Key.
 */
export async function yookassaRequest<T>(
  creds: YooKassaCredentials,
  opts: YooKassaRequestOptions
): Promise<T> {
  if (opts.method === 'POST' && !opts.idempotenceKey) {
    throw new Error('ЮKassa: для POST нужен Idempotence-Key');
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(creds),
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotenceKey) headers['Idempotence-Key'] = opts.idempotenceKey;

  let res: Response | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 1; attempt <= 2 && !res; attempt++) {
    try {
      res = await fetchImpl(`${YOOKASSA_API_BASE}${opts.path}`, {
        method: opts.method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (e) {
      lastNetworkError = e;
    }
  }
  if (!res) {
    const reason = lastNetworkError instanceof Error ? lastNetworkError.message : 'network error';
    throw new YooKassaApiError(`ЮKassa недоступна: ${reason.slice(0, 200)}`, 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const { message, code } = errorMessageFromBody(parsed, res.status);
    throw new YooKassaApiError(message, res.status, code);
  }
  if (parsed === null) {
    throw new YooKassaApiError('ЮKassa: пустой или не JSON-ответ', res.status);
  }
  return parsed as T;
}
