/**
 * Исходящие запросы к api.telegram.org с опциональным HTTPS_PROXY / HTTP_PROXY
 * (обход блокировок без правок systemd, если прокси уже поднят на VPS).
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici';

function proxyUrlFromEnv(): string | undefined {
  const raw =
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.http_proxy?.trim();
  return raw || undefined;
}

let cachedAgent: ProxyAgent | undefined;
const DEFAULT_TELEGRAM_API_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function getProxyAgent(): ProxyAgent | undefined {
  const url = proxyUrlFromEnv();
  if (!url) return undefined;
  if (!cachedAgent) {
    cachedAgent = new ProxyAgent({
      uri: url,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 300_000,
      pipelining: 1,
    });
  }
  return cachedAgent;
}

function withTelegramTimeout(init?: RequestInit): RequestInit {
  if (init?.signal) return init;
  const configuredTimeout = Number(process.env.TELEGRAM_API_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_TELEGRAM_API_TIMEOUT_MS;
  return {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export async function telegramApiFetch(input: string, init?: RequestInit): Promise<Response> {
  const agent = getProxyAgent();
  const nextInit = withTelegramTimeout(init);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!agent) {
        return await fetch(input, nextInit);
      }
      const res = await undiciFetch(input, {
        ...nextInit,
        dispatcher: agent,
      } as Parameters<typeof undiciFetch>[1]);
      return res as unknown as Response;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < MAX_RETRIES && /timeout|ECONNRESET|ECONNREFUSED|UND_ERR|abort/i.test(msg)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
