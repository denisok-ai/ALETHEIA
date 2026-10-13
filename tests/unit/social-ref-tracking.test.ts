/**
 * Сквозной учёт ?ref=: cookie av_ref (первое касание) и запись перехода.
 * БД мокаем: тестируем решения middleware, а не SQLite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { create } = vi.hoisted(() => ({ create: vi.fn(async () => ({})) }));
vi.mock('@/lib/db', () => ({ prisma: { socialLinkEvent: { create } } }));

import { acqRefFromRequest, refCookieOptions, trackRefVisit } from '@/lib/social/ref-tracking';

function req(url: string, init: { cookie?: string; headers?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers(init.headers ?? {});
  if (init.cookie) headers.set('cookie', init.cookie);
  return new NextRequest(url, { headers });
}

function setCookieOf(res: NextResponse): string | undefined {
  return res.cookies.get('av_ref')?.value;
}

beforeEach(() => {
  create.mockClear();
});

describe('trackRefVisit: cookie и журнал переходов', () => {
  it('валидная метка: ставит cookie av_ref и пишет переход с сетью по префиксу', () => {
    const res = NextResponse.next();
    const ref = trackRefVisit(req('https://avaterra.pro/lufs-checker?ref=tg-01'), res, true);
    expect(ref).toBe('tg-01');
    expect(setCookieOf(res)).toBe('tg-01');
    expect(create).toHaveBeenCalledWith({
      data: { refCode: 'tg-01', networkCode: 'telegram', path: '/lufs-checker' },
    });
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
