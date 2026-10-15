import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSeoSecret } from '@/lib/seo/secrets';

vi.mock('@/lib/seo/secrets', () => ({ getSeoSecret: vi.fn() }));

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Модули с кешем токена и user_id перечитываем на каждый тест. */
async function load() {
  vi.resetModules();
  return import('@/lib/seo/webmaster-metrics');
}

const FAKE_TOKEN = 'WEBMASTER-TOKEN-SECRET-999';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getSeoSecret).mockReset();
  vi.mocked(getSeoSecret).mockImplementation((key) => (key === 'YANDEX_WEBMASTER_TOKEN' ? FAKE_TOKEN : null));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('toMskDate', () => {
  it('переводит дату с offset в день по Москве', async () => {
    const { toMskDate } = await load();
    expect(toMskDate('2026-10-08T00:00:00.000+03:00')).toBe('2026-10-08');
    // 22:00 UTC предыдущего дня — уже 01:00 МСК следующего
    expect(toMskDate('2026-10-07T22:00:00Z')).toBe('2026-10-08');
    // формат из примера документации: запятая вместо точки, offset без двоеточия
    expect(toMskDate('2016-01-01T00:00:00,000+0300')).toBe('2016-01-01');
    expect(toMskDate('мусор')).toBeNull();
  });
});

describe('fetchWebmasterDaily', () => {
  it('нет токена → not_configured без сетевых вызовов', async () => {
    vi.mocked(getSeoSecret).mockReturnValue(null);
    const { fetchWebmasterDaily } = await load();
    const r = await fetchWebmasterDaily({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
    expect(r.status.state).toBe('not_configured');
    expect(r.rows).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('маппит индексацию и историю запросов в SeoMetricRow', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/v4/user')) return json({ user_id: 42 });
      if (url.includes('/indexing/history')) {
        return json({
          indicators: {
            HTTP_2XX: [{ date: '2026-10-08T00:00:00.000+03:00', value: 100 }],
            HTTP_4XX: [{ date: '2026-10-08T00:00:00,000+0300', value: 3 }],
          },
        });
      }
      if (url.includes('/search-queries/popular')) {
        return json({ queries: [{ query_id: 'q1', query_text: 'кинезиология' }] });
      }
      if (url.includes('/search-queries/q1/history')) {
        return json({
          indicators: {
            TOTAL_SHOWS: [{ date: '2026-10-08T00:00:00.000+03:00', value: 12 }],
            TOTAL_CLICKS: [{ date: '2026-10-08T00:00:00.000+03:00', value: 2 }],
          },
        });
      }
      return json({}, 404);
    });

    const { fetchWebmasterDaily } = await load();
    const r = await fetchWebmasterDaily({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });

    expect(r.status).toEqual({ state: 'ok' });
    expect(r.rows).toHaveLength(4);
    expect(r.rows.every((row) => row.source === 'webmaster' && row.host === 'avaterra.pro')).toBe(true);
    expect(r.rows).toEqual(
      expect.arrayContaining([
        { host: 'avaterra.pro', source: 'webmaster', date: '2026-10-08', dimension: 'indexing', key: 'http_2xx', measure: 'pages', value: 100 },
        { host: 'avaterra.pro', source: 'webmaster', date: '2026-10-08', dimension: 'indexing', key: 'http_4xx', measure: 'pages', value: 3 },
        { host: 'avaterra.pro', source: 'webmaster', date: '2026-10-08', dimension: 'query', key: 'кинезиология', measure: 'impressions', value: 12 },
        { host: 'avaterra.pro', source: 'webmaster', date: '2026-10-08', dimension: 'query', key: 'кинезиология', measure: 'clicks', value: 2 },
      ]),
    );

    // даты запроса истории — с границами дней по Москве
    const historyUrl = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/q1/history')) ?? '';
    expect(historyUrl).toContain('date_from=2026-10-08T00%3A00%3A00%2B03%3A00');
    expect(historyUrl).toContain('query_indicator=TOTAL_SHOWS');
  });

  it('сетевая ошибка → error «API Вебмастера недоступен», без исключения', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { fetchWebmasterDaily } = await load();
    const r = await fetchWebmasterDaily({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
    expect(r.status).toEqual({ state: 'error', reason: 'API Вебмастера недоступен' });
    expect(r.rows).toEqual([]);
  });

  it('HTTP 500 на индексации → error, строки не отдаём частично', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/v4/user')) return json({ user_id: 42 });
      return json({ error_message: 'boom' }, 500);
    });
    const { fetchWebmasterDaily } = await load();
    const r = await fetchWebmasterDaily({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
    expect(r.status.state).toBe('error');
    expect(r.rows).toEqual([]);
  });
});
