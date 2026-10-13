/**
 * Единый загрузчик секретов SEO-интеграций (Яндекс.Вебмастер, Метрика, Google OAuth, CrUX).
 *
 * Порядок для каждого ключа:
 *   1. process.env (пустое значение считается отсутствующим);
 *   2. файл KEY=VALUE: SEO_SECRETS_FILE или /opt/ALETHEIA/secrets/seo.env.
 *
 * Файл читается один раз и кешируется в памяти (сброс — resetSeoSecretsCache, для тестов).
 * Значения секретов никогда не логируются и не уходят наружу: seoSecretsStatus() отдаёт
 * только факт наличия (boolean).
 */
import fs from 'node:fs';

export const SEO_SECRET_KEYS = [
  'YANDEX_WEBMASTER_TOKEN',
  'YANDEX_OAUTH_TOKEN',
  'YANDEX_OAUTH_CLIENT_ID',
  'YANDEX_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'CRUX_API_KEY',
] as const;

export type SeoSecretKey = (typeof SEO_SECRET_KEYS)[number];

const DEFAULT_SECRETS_FILE = '/opt/ALETHEIA/secrets/seo.env';

/** Кеш распарсенного файла, привязан к пути — смена SEO_SECRETS_FILE не даёт устаревших значений. */
let fileCache: { path: string; values: Map<string, string> } | null = null;

function secretsFilePath(): string {
  return process.env.SEO_SECRETS_FILE?.trim() || DEFAULT_SECRETS_FILE;
}

/** Снимает парные кавычки ("..." или '...') вокруг значения. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/** Парсинг KEY=VALUE: пустые строки и строки с «#» в начале пропускаются, значения обрезаются. */
export function parseSecretsEnv(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = unquote(trimmed.slice(eq + 1).trim()).trim();
    if (key) out.set(key, value);
  }
  return out;
}

function loadFileValues(): Map<string, string> {
  const path = secretsFilePath();
  if (fileCache && fileCache.path === path) return fileCache.values;
  let values = new Map<string, string>();
  try {
    values = parseSecretsEnv(fs.readFileSync(path, 'utf8'));
  } catch {
    /* файла нет или нет прав — ключи считаются не заданными в файле */
  }
  fileCache = { path, values };
  return values;
}

/** Значение секрета: env → файл. null — не задан ни там, ни там. */
export function getSeoSecret(key: SeoSecretKey): string | null {
  const fromEnv = process.env[key]?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = loadFileValues().get(key)?.trim();
  return fromFile ? fromFile : null;
}

/** Только факт наличия по каждому ключу. Значения сюда не попадают. */
export function seoSecretsStatus(): Record<SeoSecretKey, boolean> {
  const status = {} as Record<SeoSecretKey, boolean>;
  for (const key of SEO_SECRET_KEYS) {
    status[key] = getSeoSecret(key) !== null;
  }
  return status;
}

/** Сброс кеша файла (для тестов и принудительного перечтения). */
export function resetSeoSecretsCache(): void {
  fileCache = null;
}
