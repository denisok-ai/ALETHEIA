/**
 * PayKeeper API client.
 * Документация: https://help.paykeeper.ru/
 * Конфиг: из БД (настройки админки) с fallback на переменные окружения.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';

export interface PayKeeperConfig {
  server: string;
  login: string;
  password: string;
  secret: string;
}

export interface PaymentData {
  sum: number;
  orderid: string;
  clientid: string;
  service_name: string;
  client_email: string;
  client_phone?: string;
  /** URL для редиректа после успешной оплаты (параметр user_result_callback в PayKeeper). */
  successRedirectUrl?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

const PAYKEEPER_KEYS = [
  'paykeeper_server',
  'paykeeper_login',
  'paykeeper_password',
  'paykeeper_secret',
  'paykeeper_use_test',
  'paykeeper_test_server',
  'paykeeper_test_login',
  'paykeeper_test_password',
  'paykeeper_test_secret',
] as const;
const CACHE_TTL_MS = 120_000;
let configCache: { at: number; config: PayKeeperConfig } | null = null;

export function clearPayKeeperConfigCache(): void {
  configCache = null;
}

function getConfigFromEnv(useTest?: boolean): PayKeeperConfig {
  if (useTest) {
    const server = process.env.PAYKEEPER_TEST_SERVER;
    const login = process.env.PAYKEEPER_TEST_LOGIN;
    const password = process.env.PAYKEEPER_TEST_PASSWORD;
    const secret = process.env.PAYKEEPER_TEST_SECRET;
    if (server && login && password && secret) {
      return { server, login, password, secret };
    }
  }
  const server = process.env.PAYKEEPER_SERVER;
  const login = process.env.PAYKEEPER_LOGIN;
  const password = process.env.PAYKEEPER_PASSWORD;
  const secret = process.env.PAYKEEPER_SECRET;
  if (!server || !login || !password || !secret) {
    throw new Error('PayKeeper env vars not set');
  }
  return { server, login, password, secret };
}

/**
 * Читает конфиг PayKeeper из БД (настройки админки). Секреты расшифровываются.
 * При paykeeper_use_test = 1/true используются тестовые поля (paykeeper_test_*).
 * При отсутствии данных в БД или ошибке — возвращает null (вызывающий код использует env).
 */
export async function getPayKeeperConfigFromSettings(): Promise<PayKeeperConfig | null> {
  const now = Date.now();
  if (configCache && now - configCache.at < CACHE_TTL_MS) {
    return configCache.config;
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...PAYKEEPER_KEYS] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const useTest =
    byKey.paykeeper_use_test === '1' ||
    byKey.paykeeper_use_test === 'true' ||
    String(byKey.paykeeper_use_test).toLowerCase() === 'true';

  let server: string;
  let login: string;
  let password: string;
  let secret: string;

  if (useTest) {
    server = (byKey.paykeeper_test_server || process.env.PAYKEEPER_TEST_SERVER || '').trim();
    login = (byKey.paykeeper_test_login || process.env.PAYKEEPER_TEST_LOGIN || '').trim();
    password = (process.env.PAYKEEPER_TEST_PASSWORD || '').trim();
    secret = (process.env.PAYKEEPER_TEST_SECRET || '').trim();
    if (byKey.paykeeper_test_password) {
      try {
        password = decrypt(byKey.paykeeper_test_password);
      } catch {
        password = process.env.PAYKEEPER_TEST_PASSWORD || '';
      }
    }
    if (byKey.paykeeper_test_secret) {
      try {
        secret = decrypt(byKey.paykeeper_test_secret);
      } catch {
        secret = process.env.PAYKEEPER_TEST_SECRET || '';
      }
    }
  } else {
    server = (byKey.paykeeper_server || process.env.PAYKEEPER_SERVER || '').trim();
    login = (byKey.paykeeper_login || process.env.PAYKEEPER_LOGIN || '').trim();
    password = (process.env.PAYKEEPER_PASSWORD || '').trim();
    secret = (process.env.PAYKEEPER_SECRET || '').trim();
    if (byKey.paykeeper_password) {
      try {
        password = decrypt(byKey.paykeeper_password);
      } catch {
        password = process.env.PAYKEEPER_PASSWORD || '';
      }
    }
    if (byKey.paykeeper_secret) {
      try {
        secret = decrypt(byKey.paykeeper_secret);
      } catch {
        secret = process.env.PAYKEEPER_SECRET || '';
      }
    }
  }

  if (!server || !login || !password || !secret) {
    return null;
  }
  const config: PayKeeperConfig = { server, login, password, secret };
  configCache = { at: now, config };
  return config;
}

/**
 * Возвращает конфиг PayKeeper: сначала из БД, при отсутствии — из env.
 */
async function getConfig(): Promise<PayKeeperConfig> {
  const fromSettings = await getPayKeeperConfigFromSettings();
  if (fromSettings) return fromSettings;
  const useTest = process.env.PAYKEEPER_USE_TEST === '1' || process.env.PAYKEEPER_USE_TEST === 'true';
  return getConfigFromEnv(useTest);
}

/**
 * Проверка подключения к PayKeeper: запрос токена по текущему конфигу (БД или env).
 */
export async function testPayKeeperConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { server, login, password } = await getConfig();
    const tokenRes = await fetch(`https://${server}/info/settings/token/`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
      },
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return { ok: false, error: `PayKeeper: ${tokenRes.status} ${text.slice(0, 100)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка подключения' };
  }
}

/**
 * Создание счёта в PayKeeper. Возвращает URL для редиректа на оплату.
 */
export async function createPayKeeperInvoice(
  data: PaymentData
): Promise<string> {
  const { server, login, password } = await getConfig();
  const tokenRes = await fetch(`https://${server}/info/settings/token/`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
    },
  });
  if (!tokenRes.ok) {
    throw new Error('PayKeeper token request failed');
  }
  const token = await tokenRes.text();

  const form = new URLSearchParams({
    sum: String(data.sum),
    orderid: data.orderid,
    clientid: data.clientid,
    service_name: data.service_name,
    client_email: data.client_email,
    token,
  });
  if (data.client_phone) form.set('client_phone', data.client_phone);
  if (data.successRedirectUrl) form.set('user_result_callback', data.successRedirectUrl);

  const createRes = await fetch(`https://${server}/change/invoice/preview/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`PayKeeper create invoice failed: ${text}`);
  }
  const html = await createRes.text();
  const match = html.match(/href="(https:\/\/[^"]+\/pay\/[^"]+)"/);
  if (!match) throw new Error('PayKeeper: payment URL not found in response');
  return match[1];
}

/**
 * Проверка подписи webhook от PayKeeper.
 * secret можно получить через getPayKeeperConfigFromSettings() или env.
 */
export function validatePayKeeperWebhook(
  params: Record<string, unknown>,
  secret: string
): boolean {
  const id = params.id;
  const sum = params.sum;
  const orderid = params.orderid;
  const key = params.key;
  if (typeof id !== 'string' || typeof sum !== 'string' || typeof orderid !== 'string' || typeof key !== 'string') {
    return false;
  }
  const hash = crypto
    .createHash('md5')
    .update(`${id}|${sum}|${orderid}|${secret}`)
    .digest('hex');
  return hash === key;
}
