/**
 * Коннектор Яндекс.Метрики: ежедневные итоги по сайту, источники трафика и цели.
 *
 * Только чтение: строки SeoMetricRow возвращаются наружу, в БД ничего не пишем
 * (запись — lib/seo/store.ts, оркестрация — lib/seo/sync.ts).
 * Токен — getSeoSecret('YANDEX_OAUTH_TOKEN'), запасной YANDEX_WEBMASTER_TOKEN (env → secrets-файл).
 * Функции не бросают исключения: любой сбой — статус error в результате.
 */
import { getSeoSecret } from './secrets';
import { SEO_HOST, type SeoConnectorStatus, type SeoMetricRow } from './metric-types';

/** Счётчик Метрики avaterra.pro. */
export const METRIKA_COUNTER_ID = 108390990;

const API = 'https://api-metrika.yandex.net';
/** Таймаут одного запроса к API — чтобы синхронизация не зависала. */
const TIMEOUT_MS = 15_000;
/** Лимит строк ответа Reports API за один запрос. */
const ROW_LIMIT = 10_000;
/** Сколько целей максимум в одном запросе Reports API. */
const GOALS_PER_REQUEST = 20;

export type MetrikaGoal = { id: number; name: string; type: string };

type StatResponse = {
  data?: Array<{
    dimensions?: Array<{ name?: string; id?: string }>;
    metrics?: number[];
  }>;
};

type Result<T> = { ok: true; body: T } | { ok: false; status: SeoConnectorStatus };

/** Токен Метрики: YANDEX_OAUTH_TOKEN, запасной YANDEX_WEBMASTER_TOKEN. null — не настроен. */
function getMetrikaToken(): string | null {
  return getSeoSecret('YANDEX_OAUTH_TOKEN') ?? getSeoSecret('YANDEX_WEBMASTER_TOKEN');
}

/** Короткое сообщение об ошибке из ответа API; токен из текста вычищаем на всякий случай. */
async function errorMessage(res: Response, token: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message) {
      return body.message.split(token).join('***').slice(0, 200);
    }
  } catch {
    /* тело не JSON — код ответа достаточен */
  }
  return '';
}

/** GET к API Метрики с авторизацией. Ошибки переводятся в статусы, без токена в тексте. */
async function metrikaGet<T>(
  url: string,
  token: string
): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: { state: 'error', reason: 'нет доступа к счётчику' } };
    }
    if (res.status === 429) {
      return { ok: false, status: { state: 'error', reason: 'квота Метрики исчерпана (429)' } };
    }
    if (!res.ok) {
      const msg = await errorMessage(res, token);
      const reason = `Метрика: HTTP ${res.status}${msg ? `: ${msg}` : ''}`;
      return { ok: false, status: { state: 'error', reason } };
    }
    return { ok: true, body: (await res.json()) as T };
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: { state: 'error', reason: `Метрика: запрос не удался: ${text.split(token).join('***')}` },
    };
  }
}

/** Список целей счётчика. Ошибка — статус и пустой список. */
async function loadGoals(
  counterId: number,
  token: string
): Promise<{ status: SeoConnectorStatus; goals: MetrikaGoal[] }> {
  const r = await metrikaGet<{ goals?: Array<{ id: number; name?: string; type?: string }> }>(
    `${API}/management/v1/counter/${counterId}/goals`,
    token
  );
  if (!r.ok) return { status: r.status, goals: [] };
  const goals = (r.body.goals ?? []).map((g) => ({
    id: Number(g.id),
    name: g.name ?? '',
    type: g.type ?? '',
  }));
  return { status: { state: 'ok' }, goals };
}

/** Список целей счётчика для дайджеста. При ошибке или без токена — пустой список. */
export async function fetchMetrikaGoals(counterId = METRIKA_COUNTER_ID): Promise<MetrikaGoal[]> {
  const token = getMetrikaToken();
  if (!token) return [];
  const r = await loadGoals(counterId, token);
  return r.status.state === 'ok' ? r.goals : [];
}

/** URL Reports API: accuracy=full, лимит строк, фильтр роботов — по умолчанию Метрики. */
function statUrl(
  counterId: number,
  dateFrom: string,
  dateTo: string,
  metrics: string[],
  dimensions: string[]
): string {
  const params = new URLSearchParams({
    ids: String(counterId),
    date1: dateFrom,
    date2: dateTo,
    metrics: metrics.join(','),
    dimensions: dimensions.join(','),
    accuracy: 'full',
    limit: String(ROW_LIMIT),
  });
  return `${API}/stat/v1/data?${params.toString()}`;
}

/**
 * Ежедневные строки метрики за период: итоги по сайту, источники трафика и цели.
 * Токен не настроен — not_configured без сетевых запросов.
 */
export async function fetchMetrikaDaily(opts: {
  dateFrom: string;
  dateTo: string;
  counterId?: number;
}): Promise<{ status: SeoConnectorStatus; rows: SeoMetricRow[] }> {
  const token = getMetrikaToken();
  if (!token) {
    return { status: { state: 'not_configured', reason: 'нет YANDEX_OAUTH_TOKEN' }, rows: [] };
  }
  const counterId = opts.counterId ?? METRIKA_COUNTER_ID;
  const rows: SeoMetricRow[] = [];
  const base = { host: SEO_HOST, source: 'metrika' as const };

  // a) итоги по дням — все четыре показателя, нули не выкидываем
  const totals = await metrikaGet<StatResponse>(
    statUrl(
      counterId,
      opts.dateFrom,
      opts.dateTo,
      ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews', 'ym:s:bounceRate'],
      ['ym:s:date']
    ),
    token
  );
  if (!totals.ok) return { status: totals.status, rows: [] };
  const totalMeasures = ['visits', 'users', 'pageviews', 'bounce_rate'] as const;
  for (const row of totals.body.data ?? []) {
    const date = row.dimensions?.[0]?.name ?? '';
    if (!date) continue;
    totalMeasures.forEach((measure, i) => {
      rows.push({ ...base, date, dimension: 'total', key: '', measure, value: row.metrics?.[i] ?? 0 });
    });
  }

  // b) источники трафика — ключ берём из id измерения, если его нет — из name
  const sources = await metrikaGet<StatResponse>(
    statUrl(counterId, opts.dateFrom, opts.dateTo, ['ym:s:visits'], ['ym:s:date', 'ym:s:lastTrafficSource']),
    token
  );
  if (!sources.ok) return { status: sources.status, rows: [] };
  for (const row of sources.body.data ?? []) {
    const date = row.dimensions?.[0]?.name ?? '';
    const src = row.dimensions?.[1];
    const key = src?.id || src?.name || '';
    const value = row.metrics?.[0] ?? 0;
    // нули по источникам не пишем — строк и так много
    if (!date || !key || value === 0) continue;
    rows.push({ ...base, date, dimension: 'traffic_source', key, measure: 'visits', value });
  }

  // c) цели — список, затем reaches пачками по 20 целей
  const goalsRes = await loadGoals(counterId, token);
  if (goalsRes.status.state !== 'ok') return { status: goalsRes.status, rows };
  for (let i = 0; i < goalsRes.goals.length; i += GOALS_PER_REQUEST) {
    const chunk = goalsRes.goals.slice(i, i + GOALS_PER_REQUEST);
    const metrics = chunk.map((g) => `ym:s:goal${g.id}reaches`);
    const r = await metrikaGet<StatResponse>(
      statUrl(counterId, opts.dateFrom, opts.dateTo, metrics, ['ym:s:date']),
      token
    );
    if (!r.ok) return { status: r.status, rows };
    for (const row of r.body.data ?? []) {
      const date = row.dimensions?.[0]?.name ?? '';
      if (!date) continue;
      chunk.forEach((g, j) => {
        const value = row.metrics?.[j] ?? 0;
        if (value === 0) return;
        rows.push({ ...base, date, dimension: 'goal', key: String(g.id), measure: 'reaches', value });
      });
    }
  }

  return { status: { state: 'ok' }, rows };
}
