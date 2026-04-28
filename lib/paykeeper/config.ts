/**
 * Конфиг PayKeeper из БД (Портал → Настройки → Платежи).
 */

import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';
import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { clearTokenCache } from '@/lib/paykeeper/http';

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
  clearTokenCache();
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
 * Читает конфиг PayKeeper из БД. Секреты расшифровываются.
 * При paykeeper_use_test = 1/true используются тестовые поля.
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

export async function requirePayKeeperConfig(): Promise<PayKeeperConfig> {
  const fromSettings = await getPayKeeperConfigFromSettings();
  if (fromSettings) return fromSettings;
  throw new Error('PayKeeper не настроен. Задайте параметры в Портал → Настройки → Платежи.');
}
