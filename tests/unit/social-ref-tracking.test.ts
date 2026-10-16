/**
 * Сквозной учёт ?ref=: cookie av_ref (первое касание) и запись перехода.
 * БД мокаем: тестируем решения middleware, а не SQLite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { create } = vi.hoisted(() => ({ create: vi.fn(async () => ({})) }));
vi.mock('@/lib/db', () => ({ prisma: { socialLinkEvent: { create } } }));

import {
  acqRefFromRequest,
  refCookieOptions,
  socialLinkIpHash,
  trackRefVisit,
} from '@/lib/social/ref-tracking';

function req(url: string, init: { cookie?: string; headers?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers(init.headers ?? {});
  if (init.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(url, { headers });
}

/** data первого вызова prisma.socialLinkEvent.create (мок без типов аргументов). */
function createdData(): Record<string, unknown> {
  return (create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>)[0][0].data;
}

function setCookieOf(res: NextResponse): string | undefined {
  return res.cookies.get('av_ref')?.value;
}

beforeEach(() => {
  create.mockClear();
  vi.unstubAllEnvs();
});

describe('trackRefVisit: cookie и журнал переходов', () => {
  it('валидная метка: ставит cookie av_ref и пишет переход с сетью по префиксу', () => {
    const res = NextResponse.next();
    const ref = trackRefVisit(req('https://avaterra.pro/lufs-checker?ref=tg-01'), res, true);
    expect(ref).toBe('tg-01');
    expect(setCookieOf(res)).toBe('tg-01');
    expect(create).toHaveBeenCalledWith({
      data: { refCode: 'tg-01', networkCode: 'telegram', path: '/lufs-checker', ipHash: null },
    });
  });

  it('по умолчанию хэш IP не пишется (ПДн — только по решению владельца)', () => {
    const res = NextResponse.next();
    trackRefVisit(req('https://avaterra.pro/?ref=tg-01', { headers: { 'x-real-ip': '203.0.113.7' } }), res, true);
    expect(createdData().ipHash).toBeNull();
  });

  it('с SOCIAL_LINK_IP_HASH=1 пишет хэш IP клиента, сырой IP в журнал не попадает', () => {
    vi.stubEnv('SOCIAL_LINK_IP_HASH', '1');
    const res = NextResponse.next();
    trackRefVisit(req('https://avaterra.pro/?ref=tg-01', { headers: { 'x-real-ip': '203.0.113.7' } }), res, true);
    const data = createdData();
    expect(data.ipHash).toBe(socialLinkIpHash('203.0.113.7'));
    expect(data.ipHash).toMatch(/^[0-9a-f]{48}$/);
    expect(JSON.stringify(data)).not.toContain('203.0.113.7');
  });

  it('IP берётся через lib/client-ip: подделанный первый элемент X-Forwarded-For игнорируется', () => {
    vi.stubEnv('SOCIAL_LINK_IP_HASH', '1');
    const res = NextResponse.next();
    trackRefVisit(
      req('https://avaterra.pro/?ref=tg-01', { headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' } }),
      res,
      true,
    );
    expect(createdData().ipHash).toBe(socialLinkIpHash('203.0.113.7'));
  });

  it('первое касание: существующая валидная cookie не перезаписывается, переход всё равно пишется', () => {
    const res = NextResponse.next();
    trackRefVisit(req('https://avaterra.pro/?ref=yt-02', { cookie: 'av_ref=vk-03' }), res, true);
    expect(setCookieOf(res)).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('битая старая cookie заменяется валидной меткой', () => {
    const res = NextResponse.next();
    trackRefVisit(req('https://avaterra.pro/?ref=ig-01', { cookie: 'av_ref=<x>' }), res, true);
    expect(setCookieOf(res)).toBe('ig-01');
  });

  it('некорректная метка и неизвестная сеть: ничего не делаем', () => {
    for (const url of [
      'https://avaterra.pro/?ref=TG-01',
      'https://avaterra.pro/?ref=tg-1',
      'https://avaterra.pro/?ref=fb-01',
      'https://avaterra.pro/',
    ]) {
      const res = NextResponse.next();
      expect(trackRefVisit(req(url), res, true)).toBeNull();
      expect(setCookieOf(res)).toBeUndefined();
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('prefetch и не-GET не считаются переходом', () => {
    const res = NextResponse.next();
    trackRefVisit(req('https://avaterra.pro/?ref=dz-01', { headers: { purpose: 'prefetch' } }), res, true);
    trackRefVisit(req('https://avaterra.pro/?ref=dz-01', { headers: { 'next-router-prefetch': '1' } }), res, true);
    expect(setCookieOf(res)).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('cookie: 90 дней, SameSite=Lax, Secure только в проде', () => {
    expect(refCookieOptions(true)).toMatchObject({ maxAge: 90 * 24 * 60 * 60, sameSite: 'lax', secure: true, path: '/' });
    expect(refCookieOptions(false).secure).toBe(false);
  });
});

describe('acqRefFromRequest: метка для лида и заказа', () => {
  it('берёт валидную метку из cookie, мусор отбрасывает', () => {
    expect(acqRefFromRequest(req('https://avaterra.pro/api/x', { cookie: 'av_ref=rt-01' }))).toBe('rt-01');
    expect(acqRefFromRequest(req('https://avaterra.pro/api/x', { cookie: 'av_ref=bad' }))).toBeNull();
    expect(acqRefFromRequest(req('https://avaterra.pro/api/x'))).toBeNull();
  });
});

describe('socialLinkIpHash', () => {
  const secret = 'test-secret-for-unit-tests';

  it('детерминирован для одного IP и разный для разных IP и секретов', () => {
    expect(socialLinkIpHash('198.51.100.1', secret)).toBe(socialLinkIpHash('198.51.100.1', secret));
    expect(socialLinkIpHash('198.51.100.1', secret)).not.toBe(socialLinkIpHash('198.51.100.2', secret));
    expect(socialLinkIpHash('198.51.100.1', secret)).not.toBe(socialLinkIpHash('198.51.100.1', 'another-secret-value'));
  });

  it('без IP или без достаточного секрета хэша нет (ничего не пишем вместо незащищённого значения)', () => {
    expect(socialLinkIpHash(null, secret)).toBeNull();
    expect(socialLinkIpHash('198.51.100.1', '')).toBeNull();
    expect(socialLinkIpHash('198.51.100.1', 'short')).toBeNull();
  });
});
