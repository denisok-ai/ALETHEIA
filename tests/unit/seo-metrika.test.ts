/**
 * Коннектор Метрики: маппинг строк Reports API, цели, статусы ошибок.
 * Сеть подменена через fetch-стаб, токен — через мок загрузчика секретов.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const secrets = vi.hoisted(() => ({ getSeoSecret: vi.fn<(key: string) => string | null>() }));
vi.mock('@/lib/seo/secrets', () => secrets);

import { fetchMetrikaDaily, fetchMetrikaGoals, METRIKA_COUNTER_ID } from '@/lib/seo/metrika';

const TOKEN = 'secret-token-xyz';
const fetchMock = vi.fn();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Ответы по типу запроса: отчёт по итогам, по источникам, по целям, список целей. */
type Routes = {
  totals?: Response;
  sources?: Response;
  goalsList?: Response;
  goalsStat?: Response[];
};

function routeFetch(routes: Routes) {
  const goalsStat = [...(routes.goalsStat ?? [])];
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/management/v1/counter/')) {
      return routes.goalsList ?? json(200, { goals: [] });
    }
    const u = new URL(url);
    const metrics = u.searchParams.get('metrics') ?? '';
    const dims = u.searchParams.get('dimensions') ?? '';
    if (metrics.includes('ym:s:goal')) return goalsStat.shift() ?? json(200, { data: [] });
    if (dims.includes('lastTrafficSource')) return routes.sources ?? json(200, { data: [] });
    return routes.totals ?? json(200, { data: [] });
  });
}

const reqUrls = (): string[] => fetchMock.mock.calls.map((c) => String(c[0]));
const reqHeaders = (): Array<Record<string, string>> =>
  fetchMock.mock.calls.map((c) => (c[1] as RequestInit).headers as Record<string, string>);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  secrets.getSeoSecret.mockReset();
  secrets.getSeoSecret.mockImplementation((key) => (key === 'YANDEX_OAUTH_TOKEN' ? TOKEN : null));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PERIOD = { dateFrom: '2026-10-01', dateTo: '2026-10-02' };

describe('без токена', () => {
  it('возвращает not_configured и не ходит в сеть', async () => {
    secrets.getSeoSecret.mockReturnValue(null);
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('not_configured');
    expect(r.rows).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await fetchMetrikaGoals()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('запасной токен YANDEX_WEBMASTER_TOKEN используется, если OAuth-токена нет', async () => {
    secrets.getSeoSecret.mockImplementation((key) => (key === 'YANDEX_WEBMASTER_TOKEN' ? 'wm-token' : null));
    routeFetch({});
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('ok');
    expect(reqHeaders()[0].Authorization).toBe('OAuth wm-token');
  });
});

describe('итоги по дням (total)', () => {
  it('на каждый день четыре показателя с правильными именами', async () => {
    routeFetch({
      totals: json(200, {
        data: [
          { dimensions: [{ name: '2026-10-01' }], metrics: [12, 9, 30, 55.5] },
          { dimensions: [{ name: '2026-10-02' }], metrics: [0, 0, 0, 0] },
        ],
      }),
    });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('ok');
    const total = r.rows.filter((x) => x.dimension === 'total');
    expect(total).toHaveLength(8);
    expect(total.every((x) => x.source === 'metrika' && x.host === 'avaterra.pro' && x.key === '')).toBe(true);
    expect(total.filter((x) => x.date === '2026-10-01')).toEqual([
      expect.objectContaining({ measure: 'visits', value: 12 }),
      expect.objectContaining({ measure: 'users', value: 9 }),
      expect.objectContaining({ measure: 'pageviews', value: 30 }),
      expect.objectContaining({ measure: 'bounce_rate', value: 55.5 }),
    ]);
    // нули по итогам сохраняются
    expect(total.filter((x) => x.date === '2026-10-02' && x.value === 0)).toHaveLength(4);
  });
});

describe('источники трафика', () => {
  it('ключ берётся из id измерения', async () => {
    routeFetch({
      sources: json(200, {
        data: [
          { dimensions: [{ name: '2026-10-01' }, { name: 'Поиск', id: 'organic' }], metrics: [7] },
          { dimensions: [{ name: '2026-10-01' }, { name: 'Прямые' }], metrics: [3] },
        ],
      }),
    });
    const r = await fetchMetrikaDaily(PERIOD);
    const src = r.rows.filter((x) => x.dimension === 'traffic_source');
    expect(src).toEqual([
      expect.objectContaining({ key: 'organic', measure: 'visits', value: 7, date: '2026-10-01' }),
      // без id — запасной вариант name
      expect.objectContaining({ key: 'Прямые', measure: 'visits', value: 3 }),
    ]);
  });
});

describe('цели', () => {
  it('сначала список целей, затем reaches по каждой цели', async () => {
    routeFetch({
      goalsList: json(200, {
        goals: [
          { id: 101, name: 'Заявка', type: 'action' },
          { id: 202, name: 'Оплата', type: 'url' },
        ],
      }),
      goalsStat: [
        json(200, { data: [{ dimensions: [{ name: '2026-10-01' }], metrics: [4, 1] }] }),
      ],
    });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('ok');
    // порядок запросов: сначала список, потом отчёт по целям
    const goalsListIdx = reqUrls().findIndex((u) =>
      u.includes(`/management/v1/counter/${METRIKA_COUNTER_ID}/goals`)
    );
    const goalsStatIdx = reqUrls().findIndex((u) => u.includes('ym%3As%3Agoal101reaches'));
    expect(goalsListIdx).toBeGreaterThanOrEqual(0);
    expect(goalsStatIdx).toBeGreaterThan(goalsListIdx);
    expect(reqUrls()[goalsStatIdx]).toContain('ym%3As%3Agoal202reaches');
    const goals = r.rows.filter((x) => x.dimension === 'goal');
    expect(goals).toEqual([
      expect.objectContaining({ key: '101', measure: 'reaches', value: 4, date: '2026-10-01' }),
      expect.objectContaining({ key: '202', measure: 'reaches', value: 1, date: '2026-10-01' }),
    ]);
  });

  it('пустой список целей — только итоги и источники', async () => {
    routeFetch({
      goalsList: json(200, { goals: [] }),
      totals: json(200, { data: [{ dimensions: [{ name: '2026-10-01' }], metrics: [1, 1, 1, 0] }] }),
    });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('ok');
    expect(r.rows.some((x) => x.dimension === 'goal')).toBe(false);
    // списка целей запрошено, но отчёта по целям (metrics=ym:s:goal…) нет
    expect(reqUrls().some((u) => u.includes('ym%3As%3Agoal'))).toBe(false);
  });
});

describe('ошибки', () => {
  it('403 → error «нет доступа к счётчику»', async () => {
    routeFetch({ totals: json(403, { message: 'forbidden' }) });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status).toEqual({ state: 'error', reason: 'нет доступа к счётчику' });
    expect(r.rows).toEqual([]);
  });

  it('429 → error про квоту', async () => {
    routeFetch({ totals: json(429, { message: 'limit' }) });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('error');
    expect(r.status.state === 'error' && r.status.reason).toContain('квота');
  });

  it('прочая ошибка → error с кодом и message из JSON', async () => {
    routeFetch({ totals: json(400, { message: 'Invalid date range' }) });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status).toEqual({ state: 'error', reason: 'Метрика: HTTP 400: Invalid date range' });
  });

  it('токен не попадает в тексты ошибок', async () => {
    routeFetch({ totals: json(400, { message: `bad token ${TOKEN}` }) });
    const r = await fetchMetrikaDaily(PERIOD);
    expect(JSON.stringify(r)).not.toContain(TOKEN);

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error(`network ${TOKEN}`));
    const r2 = await fetchMetrikaDaily(PERIOD);
    expect(r2.status.state).toBe('error');
    expect(JSON.stringify(r2)).not.toContain(TOKEN);
  });

  it('сетевой сбой не бросает исключение наружу', async () => {
    fetchMock.mockRejectedValue(new Error('ENOTFOUND'));
    const r = await fetchMetrikaDaily(PERIOD);
    expect(r.status.state).toBe('error');
  });
});

describe('параметры запроса', () => {
  it('accuracy=full, date1/date2 и заголовок OAuth', async () => {
    routeFetch({});
    await fetchMetrikaDaily(PERIOD);
    const statUrls = reqUrls().filter((u) => u.includes('/stat/v1/data'));
    expect(statUrls.length).toBeGreaterThan(0);
    for (const u of statUrls) {
      const p = new URL(u).searchParams;
      expect(p.get('accuracy')).toBe('full');
      expect(p.get('date1')).toBe('2026-10-01');
      expect(p.get('date2')).toBe('2026-10-02');
      expect(p.get('ids')).toBe(String(METRIKA_COUNTER_ID));
    }
    for (const h of reqHeaders()) {
      expect(h.Authorization).toBe(`OAuth ${TOKEN}`);
    }
  });
});

describe('fetchMetrikaGoals', () => {
  it('возвращает id, name, type', async () => {
    routeFetch({
      goalsList: json(200, { goals: [{ id: 7, name: 'Заявка', type: 'action', default_price: 0 }] }),
    });
    expect(await fetchMetrikaGoals()).toEqual([{ id: 7, name: 'Заявка', type: 'action' }]);
  });
});
