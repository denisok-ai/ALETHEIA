/**
 * Яндекс.Вебмастер API: переобход URL и метрики индексации.
 *
 * Токен лежит НЕ в .env приложения, а в /opt/ALETHEIA/secrets/seo.env
 * (каталог 700, файл 600) — чтобы SEO-доступ не разъезжался по бэкапам
 * и деплой-веткам вместе с обычным окружением. Читаем файл напрямую.
 *
 * Зачем: аудит 30.08.2026 показал ИКС=0 и ~9 показов при нормальной
 * индексации (52/59 в поиске). Переобход новых статей и еженедельный
 * контроль динамики — та часть рычага, которую можно автоматизировать.
 */
import fs from 'node:fs';

const API = 'https://api.webmaster.yandex.net/v4';
export const HOST_ID = 'https:avaterra.pro:443';
const SECRETS_FILE = process.env.SEO_SECRETS_FILE?.trim() || '/opt/ALETHEIA/secrets/seo.env';

let cachedToken: string | null | undefined;
let cachedUserId: number | undefined;

/** Токен из secrets-файла (fallback — переменная окружения). null — не настроен. */
export function getWebmasterToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  let token = process.env.YANDEX_WEBMASTER_TOKEN?.trim() || '';
  if (!token) {
    try {
      const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
      token = raw.match(/^YANDEX_WEBMASTER_TOKEN=(.+)$/m)?.[1]?.trim() ?? '';
    } catch {
      /* файла нет — токен не настроен */
    }
  }
  cachedToken = token || null;
  return cachedToken;
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = getWebmasterToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `OAuth ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // 429 на переобходе = квота исчерпана — это ожидаемый исход, не ошибка кода.
      if (res.status !== 429) {
        console.warn(`[yandex-webmaster] ${path}: HTTP ${res.status}`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn('[yandex-webmaster] запрос не удался:', path, e instanceof Error ? e.message : e);
    return null;
  }
}

async function userId(): Promise<number | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  const u = await api<{ user_id: number }>('/user');
  if (!u) return null;
  cachedUserId = u.user_id;
  return cachedUserId;
}

function hostBase(uid: number): string {
  return `/user/${uid}/hosts/${HOST_ID}`;
}

/** Отправить URL на переобход. true — принят (false — квота/ошибка/нет токена). */
export async function recrawlUrl(url: string): Promise<boolean> {
  const uid = await userId();
  if (!uid) return false;
  const r = await api<{ task_id?: string }>(`${hostBase(uid)}/recrawl/queue`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return Boolean(r?.task_id);
}

export type WebmasterDigest = {
  sqi: number;
  searchablePages: number;
  problems: string[]; // коды проблем в состоянии PRESENT
  quotaRemainder: number;
  topQueries: Array<{ query: string; shows: number; clicks: number }>;
};

/** Сводка для еженедельного дайджеста. null — токен не настроен или API недоступен. */
export async function fetchWebmasterDigest(): Promise<WebmasterDigest | null> {
  const uid = await userId();
  if (!uid) return null;
  const base = hostBase(uid);

  const [summary, quota, queries, diag] = await Promise.all([
    api<{ sqi: number; searchable_pages_count: number }>(`${base}/summary`),
    api<{ quota_remainder: number }>(`${base}/recrawl/quota`),
    api<{ queries: Array<{ query_text: string; indicators?: Record<string, number> }> }>(
      `${base}/search-queries/popular?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS`
    ),
    api<{ problems: Record<string, { severity: string; state: string }> }>(`${base}/diagnostics`),
  ]);
  if (!summary) return null;

  const problems = Object.entries(diag?.problems ?? {})
    .filter(([, p]) => p.state === 'PRESENT')
    .map(([code]) => code);

  const topQueries = (queries?.queries ?? []).slice(0, 8).map((q) => ({
    query: q.query_text,
    shows: Math.round(q.indicators?.TOTAL_SHOWS ?? 0),
    clicks: Math.round(q.indicators?.TOTAL_CLICKS ?? 0),
  }));

  return {
    sqi: summary.sqi,
    searchablePages: summary.searchable_pages_count,
    problems,
    quotaRemainder: quota?.quota_remainder ?? 0,
    topQueries,
  };
}
