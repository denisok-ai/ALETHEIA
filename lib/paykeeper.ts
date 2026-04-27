/**
 * PayKeeper API client.
 * Документация: https://help.paykeeper.ru/
 * Конфиг: из БД (Портал → Настройки → Платежи). Настройки вынесены в админку.
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

export function normalizePayKeeperServer(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.host.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .trim()
      .toLowerCase();
  }
}

function decryptSetting(value: string | undefined): string {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch {
    return '';
  }
}

function completeConfig(config: PayKeeperConfig): PayKeeperConfig | null {
  const server = normalizePayKeeperServer(config.server);
  const login = config.login.trim();
  const password = config.password.trim();
  const secret = config.secret.trim();

  if (!server || !login || !password || !secret) return null;
  return { server, login, password, secret };
}

/**
 * Читает конфиг PayKeeper из БД (Портал → Настройки → Платежи). Секреты расшифровываются.
 * При paykeeper_use_test = 1/true используются тестовые поля (paykeeper_test_*).
 * Env-fallback не используется: настройки PayKeeper должны храниться в БД.
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

  const rawConfig = useTest
    ? {
        server: byKey.paykeeper_test_server || '',
        login: byKey.paykeeper_test_login || '',
        password: decryptSetting(byKey.paykeeper_test_password),
        secret: decryptSetting(byKey.paykeeper_test_secret),
      }
    : {
        server: byKey.paykeeper_server || '',
        login: byKey.paykeeper_login || '',
        password: decryptSetting(byKey.paykeeper_password),
        secret: decryptSetting(byKey.paykeeper_secret),
      };

  const config = completeConfig(rawConfig);
  if (!config) return null;

  configCache = { at: now, config };
  return config;
}

/**
 * Возвращает конфиг PayKeeper из БД. Бросает, если не настроено.
 */
async function getConfig(): Promise<PayKeeperConfig> {
  const fromSettings = await getPayKeeperConfigFromSettings();
  if (fromSettings) return fromSettings;
  throw new Error('PayKeeper не настроен. Задайте параметры в Портал → Настройки → Платежи.');
}

/**
 * Проверка подключения к PayKeeper: запрос токена по текущему конфигу из БД.
 */
export async function testPayKeeperConnection(): Promise<{ ok: boolean; error?: string }> {
  let server = '';
  try {
    const config = await getConfig();
    server = config.server;
    const { login, password } = config;
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
    parsePayKeeperToken(await tokenRes.text());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatPayKeeperConnectionError(e, server) };
  }
}

export function formatPayKeeperConnectionError(error: unknown, server = ''): string {
  if (!(error instanceof Error)) return 'Ошибка подключения к PayKeeper';
  const cause = error.cause as { code?: string } | undefined;
  if (cause?.code === 'ENOTFOUND') {
    return `Не удалось найти сервер PayKeeper${server ? `: ${server}` : ''}. Проверьте адрес сервера в настройках.`;
  }
  if (cause?.code === 'ECONNREFUSED') {
    return `Сервер PayKeeper${server ? ` ${server}` : ''} отклонил подключение. Проверьте адрес и доступность API.`;
  }
  if (cause?.code === 'ETIMEDOUT' || cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `Сервер PayKeeper${server ? ` ${server}` : ''} не ответил вовремя. Проверьте сеть или адрес сервера.`;
  }
  if (/token not found/i.test(error.message)) {
    return 'PayKeeper ответил, но токен не найден в ответе. Проверьте логин, пароль и права API-пользователя.';
  }
  return error.message || 'Ошибка подключения к PayKeeper';
}

export function parsePayKeeperToken(responseText: string): string {
  const trimmed = responseText.trim();
  try {
    const parsed = JSON.parse(trimmed) as { token?: unknown };
    if (typeof parsed.token === 'string' && parsed.token.trim()) {
      return parsed.token.trim();
    }
  } catch {
    // Некоторые инсталляции могут отдавать токен текстом, оставляем совместимость.
  }

  if (/^[a-f0-9]{16,}$/i.test(trimmed)) return trimmed;
  throw new Error('PayKeeper token not found in response');
}

export function parsePayKeeperInvoiceResponse(responseText: string, server: string): string {
  const normalizedServer = normalizePayKeeperServer(server);
  const trimmed = responseText.trim();

  try {
    const parsed = JSON.parse(trimmed) as { invoice_id?: unknown };
    if (typeof parsed.invoice_id === 'string' || typeof parsed.invoice_id === 'number') {
      return `https://${normalizedServer}/bill/${encodeURIComponent(String(parsed.invoice_id))}/`;
    }
  } catch {
    // Старый fallback: если платформа вернула HTML со ссылкой.
  }

  const match = trimmed.match(/href=["'](https:\/\/[^"']+\/(?:bill|pay)\/[^"']+)["']/);
  if (match) return match[1];
  throw new Error('PayKeeper: invoice_id not found in response');
}

export function buildPayKeeperInvoiceParams(data: PaymentData, token: string): URLSearchParams {
  const form = new URLSearchParams({
    pay_amount: String(data.sum),
    orderid: data.orderid,
    clientid: data.clientid,
    service_name: data.service_name,
    client_email: data.client_email,
    token,
  });
  if (data.client_phone) form.set('client_phone', data.client_phone);
  if (data.successRedirectUrl) form.set('user_result_callback', data.successRedirectUrl);
  return form;
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
  const token = parsePayKeeperToken(await tokenRes.text());

  const form = buildPayKeeperInvoiceParams(data, token);

  const createRes = await fetch(`https://${server}/change/invoice/preview/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`PayKeeper create invoice failed: ${text}`);
  }
  return parsePayKeeperInvoiceResponse(await createRes.text(), server);
}

/**
 * Проверка подписи webhook от PayKeeper.
 * secret получается через getPayKeeperConfigFromSettings() (БД).
 */
export function validatePayKeeperWebhook(
  params: Record<string, unknown>,
  secret: string
): boolean {
  const id = params.id;
  const sum = params.sum;
  const clientid = params.clientid;
  const orderid = params.orderid;
  const key = params.key;
  if (
    typeof id !== 'string' ||
    typeof sum !== 'string' ||
    typeof clientid !== 'string' ||
    typeof orderid !== 'string' ||
    typeof key !== 'string'
  ) {
    return false;
  }
  const hash = crypto
    .createHash('md5')
    .update(`${id}${sum}${clientid}${orderid}${secret}`)
    .digest('hex');
  return hash === key;
}

export function buildPayKeeperWebhookResponse(id: string, secret: string): string {
  const hash = crypto.createHash('md5').update(`${id}${secret}`).digest('hex');
  return `OK ${hash}`;
}
