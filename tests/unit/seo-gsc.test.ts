import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGscDaily, listSitemaps, submitSitemap, GSC_SITE_URL } from '@/lib/seo/gsc';
import { getGoogleAccessToken, resetGoogleTokenCache } from '@/lib/seo/google-oauth';
import { getSeoSecret } from '@/lib/seo/secrets';

vi.mock('@/lib/seo/secrets', () => ({ getSeoSecret: vi.fn() }));

const FAKE_SECRETS: Record<string, string> = {
  GOOGLE_OAUTH_CLIENT_ID: 'CLIENT-ID-SECRET-111',
  GOOGLE_OAUTH_CLIENT_SECRET: 'CLIENT-SECRET-SECRET-222',
  GOOGLE_OAUTH_REFRESH_TOKEN: 'REFRESH-SECRET-333',
};
const ACCESS_TOKEN = 'ACCESS-TOKEN-XYZ';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Ответ /token: успешный или с заданным error. */
function tokenOk(expiresIn = 3600): Response {
  return json({ access_token: ACCESS_TOKEN, expires_in: expiresIn, token_type: 'Bearer' });
}

function isTokenCall(url: string): boolean {
  return url === 'https://oauth2.googleapis.com/token';
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

beforeEach(() => {
  resetGoogleTokenCache();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getSeoSecret).mockReset();
  vi.mocked(getSeoSecret).mockImplementation((key) => FAKE_SECRETS[key] ?? null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getGoogleAccessToken', () => {
  it('нет ключей → not_configured без сетевых вызовов', async () => {
    vi.mocked(getSeoSecret).mockReturnValue(null);
    const r = await getGoogleAccessToken();
    expect(r.status.state).toBe('not_configured');
    expect(r.token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('invalid_grant → error с понятным текстом про refresh-токен', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400));
    const r = await getGoogleAccessToken();
    expect(r.token).toBeNull();
    expect(r.status.state).toBe('error');
    if (r.status.state === 'error') expect(r.status.reason).toContain('refresh-токен');
  });

  it('кеширует токен: второй вызов не идёт в /token', async () => {
    fetchMock.mockResolvedValueOnce(tokenOk(3600));
    const first = await getGoogleAccessToken();
    const second = await getGoogleAccessToken();
    expect(first.token).toBe(ACCESS_TOKEN);
    expect(second.token).toBe(ACCESS_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('токен с expires_in меньше запаса не кешируется', async () => {
    fetchMock.mockResolvedValue(tokenOk(30));
    await getGoogleAccessToken();
    await getGoogleAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('fetchGscDaily', () => {
  it('нет ключей → not_configured и пустые строки без сетевых вызовов', async () => {
    vi.mocked(getSeoSecret).mockReturnValue(null);
    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    expect(r).toEqual({ status: expect.objectContaining({ state: 'not_configured' }), rows: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('маппит строки searchAnalytics в четыре показателя на строку', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (isTokenCall(url)) return tokenOk();
      const dims = bodyOf(init).dimensions as string[];
      if (dims.length === 1) {
        return json({ rows: [{ keys: ['2026-10-09'], clicks: 3, impressions: 40, ctr: 0.075, position: 12.5 }] });
      }
      if (dims[1] === 'query') {
        return json({ rows: [{ keys: ['2026-10-09', 'кинезиология'], clicks: 1, impressions: 5, ctr: 0.2, position: 7 }] });
      }
      return json({});
    });

    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    expect(r.status.state).toBe('ok');
    expect(r.rows).toHaveLength(4 + 4);

    const total = r.rows.filter((x) => x.dimension === 'total');
    expect(total).toEqual([
      { host: 'avaterra.pro', source: 'gsc', date: '2026-10-09', dimension: 'total', key: '', measure: 'clicks', value: 3 },
      { host: 'avaterra.pro', source: 'gsc', date: '2026-10-09', dimension: 'total', key: '', measure: 'impressions', value: 40 },
      { host: 'avaterra.pro', source: 'gsc', date: '2026-10-09', dimension: 'total', key: '', measure: 'ctr', value: 0.075 },
      { host: 'avaterra.pro', source: 'gsc', date: '2026-10-09', dimension: 'total', key: '', measure: 'position', value: 12.5 },
    ]);

    const query = r.rows.filter((x) => x.dimension === 'query');
    expect(query.map((x) => x.key)).toEqual(['кинезиология', 'кинезиология', 'кинезиология', 'кинезиология']);
    expect(query.find((x) => x.measure === 'position')?.value).toBe(7);
  });

  it('пагинация: идёт по startRow, пока страница полная', async () => {
    const seen: number[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (isTokenCall(url)) return tokenOk();
      const body = bodyOf(init);
      if ((body.dimensions as string[]).length !== 1) return json({});
      seen.push(body.startRow as number);
      const page = (body.startRow as number) === 0
        ? [{ keys: ['2026-10-01'], clicks: 1 }, { keys: ['2026-10-02'], clicks: 2 }]
        : [{ keys: ['2026-10-03'], clicks: 3 }];
      return json({ rows: page });
    });

    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-03', rowLimit: 2 });
    expect(seen).toEqual([0, 2]);
    const clicks = r.rows.filter((x) => x.dimension === 'total' && x.measure === 'clicks');
    expect(clicks.map((x) => x.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('403 → error с понятным текстом про права', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isTokenCall(url)) return tokenOk();
      return json({ error: { message: 'User does not have sufficient permission' } }, 403);
    });
    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    expect(r.rows).toEqual([]);
    expect(r.status.state).toBe('error');
    if (r.status.state === 'error') expect(r.status.reason).toContain('нет доступа к ресурсу');
  });

  it('пустой ответ (нет rows) → ok и []', async () => {
    fetchMock.mockImplementation(async (url: string) => (isTokenCall(url) ? tokenOk() : json({})));
    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    expect(r).toEqual({ status: { state: 'ok' }, rows: [] });
  });

  it('секреты и токен не попадают в тексты ошибок', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isTokenCall(url)) return tokenOk();
      return json({ error: 'SECRET-LEAK-TEST' }, 500);
    });
    const r = await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    const text = JSON.stringify(r);
    for (const secret of [...Object.values(FAKE_SECRETS), ACCESS_TOKEN, 'SECRET-LEAK-TEST']) {
      expect(text).not.toContain(secret);
    }
    expect(r.status.state).toBe('error');
  });

  it('кодирует siteUrl в пути запроса', async () => {
    const urls: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      if (isTokenCall(url)) return tokenOk();
      urls.push(url);
      return json({});
    });
    await fetchGscDaily({ dateFrom: '2026-10-01', dateTo: '2026-10-10' });
    expect(urls[0]).toBe(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`
    );
  });
});

describe('sitemaps', () => {
  it('listSitemaps разбирает счётчики строками в числа', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isTokenCall(url)) return tokenOk();
      return json({
        sitemap: [{ path: 'https://avaterra.pro/sitemap.xml', lastSubmitted: '2026-10-01T00:00:00Z', isPending: false, errors: '0', warnings: '2' }],
      });
    });
    const r = await listSitemaps();
    expect(r.status.state).toBe('ok');
    expect(r.sitemaps).toEqual([
      { path: 'https://avaterra.pro/sitemap.xml', lastSubmitted: '2026-10-01T00:00:00Z', isPending: false, errors: 0, warnings: 2 },
    ]);
  });

  it('submitSitemap: PUT с закодированным feedpath, 204 → ok', async () => {
    let call: { url: string; method?: string } | undefined;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (isTokenCall(url)) return tokenOk();
      call = { url, method: init?.method };
      return new Response(null, { status: 204 });
    });
    const r = await submitSitemap('https://avaterra.pro/sitemap.xml');
    expect(r.status.state).toBe('ok');
    expect(call?.method).toBe('PUT');
    expect(call?.url).toContain(`/sitemaps/${encodeURIComponent('https://avaterra.pro/sitemap.xml')}`);
  });

  it('submitSitemap при 429 → error про квоту', async () => {
    fetchMock.mockImplementation(async (url: string) => (isTokenCall(url) ? tokenOk() : json({}, 429)));
    const r = await submitSitemap('https://avaterra.pro/sitemap.xml');
    expect(r.status.state).toBe('error');
    if (r.status.state === 'error') expect(r.status.reason).toContain('квота');
  });
});
