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

export async function telegramApiFetch(input: string, init?: RequestInit): Promise<Response> {
  const agent = getProxyAgent();
  if (!agent) {
    return fetch(input, init);
  }
  const res = await undiciFetch(input, {
    ...init,
    dispatcher: agent,
  } as Parameters<typeof undiciFetch>[1]);
  return res as unknown as Response;
}
