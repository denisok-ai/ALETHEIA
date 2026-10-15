/**
 * HTTP к API MAX (platform-api2.max.ru и хосты загрузки медиа).
 *
 * Свой undici-агент: стандартные корни Node + корневой сертификат Минцифры (max-ca.ts).
 * Без него TLS к platform-api2.max.ru не проходит. Прокси не нужен: MAX — российский сервис,
 * VPS ходит к нему напрямую. Отдельный модуль — чтобы тесты подменяли сеть одной строкой.
 */
import tls from 'node:tls';
import { Agent, fetch as undiciFetch } from 'undici';
import { RUSSIAN_TRUSTED_ROOT_CA_PEM } from './max-ca';

let agent: Agent | undefined;

function maxAgent(): Agent {
  if (!agent) {
    agent = new Agent({ connect: { ca: [...tls.rootCertificates, RUSSIAN_TRUSTED_ROOT_CA_PEM] } });
  }
  return agent;
}

export async function maxFetch(url: string, init: RequestInit): Promise<Response> {
  // undici и глобальный fetch типизированы разными пакетами: тела и ответы совместимы по факту.
  const res = await undiciFetch(url, { ...(init as object), dispatcher: maxAgent() } as Parameters<typeof undiciFetch>[1]);
  return res as unknown as Response;
}
