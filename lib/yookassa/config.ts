/**
 * Конфиг ЮKassa из БД (Портал → Настройки → Платежи → ЮKassa).
 * Секреты (secret key) хранятся зашифрованными (lib/encrypt), как секреты PayKeeper.
 */
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encrypt';
import {
  PAYMENT_MODES,
  PAYMENT_SUBJECTS,
  TAX_SYSTEM_CODES,
  VAT_CODES,
} from '@/lib/yookassa/payloads';
import type { YooKassaReceiptSettings } from '@/lib/yookassa/types';

export const YOOKASSA_SETTING_KEYS = [
  'yookassa_shop_id',
  'yookassa_secret_key',
  'yookassa_use_test',
  'yookassa_test_shop_id',
  'yookassa_test_secret_key',
  'yookassa_receipts_enabled',
  'yookassa_tax_system_code',
  'yookassa_vat_code',
  'yookassa_payment_subject',
  'yookassa_payment_mode',
  'yookassa_return_url',
  'yookassa_ip_check',
] as const;

export type YooKassaConfig = {
  shopId: string;
  secretKey: string;
  /** Тестовый магазин ЮKassa (отдельные shopId и secretKey). */
  test: boolean;
  receipts: YooKassaReceiptSettings;
  /** Базовый URL для return_url (например https://avaterra.pro); null — берём site_url. */
  returnUrlBase: string | null;
  /** Проверять IP отправителя уведомления по списку ЮKassa. */
  ipCheck: boolean;
};

const DEFAULT_TAX_SYSTEM_CODE = 2; // УСН «доходы»
const DEFAULT_VAT_CODE = 1; // без НДС
const DEFAULT_PAYMENT_SUBJECT = 'service';
const DEFAULT_PAYMENT_MODE = 'full_payment';

function isTruthyFlag(v: string | undefined): boolean {
  const t = (v ?? '').trim().toLowerCase();
  return t === '1' || t === 'true';
}

function intInList(raw: string | undefined, allowed: readonly number[], fallback: number): number {
  const n = parseInt((raw ?? '').trim(), 10);
  return allowed.includes(n) ? n : fallback;
}

function strInList(raw: string | undefined, allowed: readonly string[], fallback: string): string {
  const v = (raw ?? '').trim();
  return (allowed as readonly string[]).includes(v) ? v : fallback;
}

/**
 * Чистый разбор настроек (без БД). Возвращает null, если не заданы shopId или секрет
 * для выбранного режима (боевой / тестовый). Ошибки расшифровки дают пустой секрет.
 */
export function parseYooKassaSettings(
  byKey: Partial<Record<(typeof YOOKASSA_SETTING_KEYS)[number], string>>,
  decryptValue: (encoded: string) => string
): YooKassaConfig | null {
  const test = isTruthyFlag(byKey.yookassa_use_test);
  const shopId = (test ? byKey.yookassa_test_shop_id : byKey.yookassa_shop_id)?.trim() ?? '';
  const encryptedSecret = test ? byKey.yookassa_test_secret_key : byKey.yookassa_secret_key;
  let secretKey = '';
  if (encryptedSecret) {
    try {
      secretKey = decryptValue(encryptedSecret).trim();
    } catch {
      secretKey = '';
    }
  }
  if (!shopId || !secretKey) return null;

  const returnUrlBase = (byKey.yookassa_return_url ?? '').trim().replace(/\/+$/, '') || null;

  return {
    shopId,
    secretKey,
    test,
    receipts: {
      enabled: isTruthyFlag(byKey.yookassa_receipts_enabled),
      taxSystemCode: intInList(byKey.yookassa_tax_system_code, TAX_SYSTEM_CODES, DEFAULT_TAX_SYSTEM_CODE),
      vatCode: intInList(byKey.yookassa_vat_code, VAT_CODES, DEFAULT_VAT_CODE),
      paymentSubject: strInList(byKey.yookassa_payment_subject, PAYMENT_SUBJECTS, DEFAULT_PAYMENT_SUBJECT),
      paymentMode: strInList(byKey.yookassa_payment_mode, PAYMENT_MODES, DEFAULT_PAYMENT_MODE),
    },
    returnUrlBase,
    ipCheck: isTruthyFlag(byKey.yookassa_ip_check),
  };
}

function safeDecrypt(encoded: string): string {
  try {
    return decrypt(encoded);
  } catch {
    return '';
  }
}

const CACHE_TTL_MS = 120_000;
let configCache: { at: number; config: YooKassaConfig | null } | null = null;

export function clearYooKassaConfigCache(): void {
  configCache = null;
}

export async function getYooKassaConfigFromSettings(): Promise<YooKassaConfig | null> {
  const now = Date.now();
  if (configCache && now - configCache.at < CACHE_TTL_MS) return configCache.config;

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...YOOKASSA_SETTING_KEYS] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<
    Record<(typeof YOOKASSA_SETTING_KEYS)[number], string>
  >;
  const config = parseYooKassaSettings(byKey, safeDecrypt);
  configCache = { at: now, config };
  return config;
}

export async function requireYooKassaConfig(): Promise<YooKassaConfig> {
  const cfg = await getYooKassaConfigFromSettings();
  if (cfg) return cfg;
  throw new Error('ЮKassa не настроена. Задайте shopId и секретный ключ в Портал → Настройки → Платежи.');
}
