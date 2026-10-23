/**
 * Сторож связи с Telegram: переходы состояния без сети и БД.
 * Кейсы — инцидент 23.10.2026 (два часа падений): алерт один раз, без спама;
 * одиночные сбои прокси не тревожат; восстановление сообщаем только после тревоги.
 */
import { describe, expect, it } from 'vitest';
import {
  cleanTelegramError,
  decideTelegramEgress,
  formatTelegramDowntime,
  type TelegramEgressState,
} from '@/lib/telegram-egress-health';

const T0 = Date.parse('2026-10-23T11:00:00.000Z');
/** Момент через min минут после T0. */
const at = (min: number) => new Date(T0 + min * 60_000);
const iso = (min: number) => at(min).toISOString();

const FAIL = { ok: false, error: 'fetch failed' };
const OK = { ok: true };

describe('decideTelegramEgress: падение', () => {
  it('первая и вторая неудача — без алерта', () => {
    const first = decideTelegramEgress(null, FAIL, at(0));
    expect(first.action).toBe('none');
    expect(first.next).toEqual({ status: 'fail', since: iso(0), failStreak: 1, lastError: 'fetch failed' });

    const second = decideTelegramEgress(first.next, FAIL, at(5));
    expect(second.action).toBe('none');
    expect(second.next.failStreak).toBe(2);
    expect(second.next.since).toBe(iso(0));
    expect(second.next.lastAlertAt).toBeUndefined();
  });

  it('третья неудача подряд — alert_down и отметка времени письма', () => {
    const prev: TelegramEgressState = { status: 'fail', since: iso(0), failStreak: 2, lastError: 'fetch failed' };
    const r = decideTelegramEgress(prev, FAIL, at(10));
    expect(r.action).toBe('alert_down');
    expect(r.next).toEqual({
      status: 'fail',
      since: iso(0),
      failStreak: 3,
      lastAlertAt: iso(10),
      lastError: 'fetch failed',
    });
  });

  it('после тревоги молчим до 6 часов, затем remind_down', () => {
    const alerted: TelegramEgressState = { status: 'fail', since: iso(0), failStreak: 3, lastAlertAt: iso(10) };
    expect(decideTelegramEgress(alerted, FAIL, at(15)).action).toBe('none');
    expect(decideTelegramEgress(alerted, FAIL, at(10 + 359)).action).toBe('none');

    const remind = decideTelegramEgress(alerted, FAIL, at(10 + 360));
    expect(remind.action).toBe('remind_down');
    expect(remind.next.lastAlertAt).toBe(iso(370));
    expect(remind.next.failStreak).toBe(4);
  });

  it('отметка тревоги, которую не разобрать, не глушит алерт навсегда', () => {
    const broken: TelegramEgressState = { status: 'fail', since: iso(0), failStreak: 3, lastAlertAt: 'не дата' };
    expect(decideTelegramEgress(broken, FAIL, at(20)).action).toBe('alert_down');
  });

  it('текст ошибки очищается от токена бота', () => {
    const r = decideTelegramEgress(
      null,
      { ok: false, error: 'request to https://api.telegram.org/bot123456:AAH_x-9/getMe failed' },
      at(0)
    );
    expect(r.next.lastError).not.toContain('AAH_x-9');
    expect(r.next.lastError).toContain('bot<скрыт>');
  });
});

describe('decideTelegramEgress: восстановление', () => {
  it('восстановление после тревоги — notify_recovered, счётчик сброшен, отметка тревоги снята', () => {
    const alerted: TelegramEgressState = {
      status: 'fail',
      since: iso(0),
      failStreak: 7,
      lastAlertAt: iso(10),
      lastError: 'fetch failed',
    };
    const r = decideTelegramEgress(alerted, OK, at(120));
    expect(r.action).toBe('notify_recovered');
    expect(r.next).toEqual({ status: 'ok', since: iso(120), failStreak: 0 });
  });

  it('восстановление после одной-двух неудач — без уведомлений, счётчик обнуляется', () => {
    const two: TelegramEgressState = { status: 'fail', since: iso(0), failStreak: 2 };
    const r = decideTelegramEgress(two, OK, at(10));
    expect(r.action).toBe('none');
    expect(r.next).toEqual({ status: 'ok', since: iso(10), failStreak: 0 });
  });

  it('успехи подряд не сдвигают since', () => {
    const ok: TelegramEgressState = { status: 'ok', since: iso(-500), failStreak: 0 };
    const r = decideTelegramEgress(ok, OK, at(5));
    expect(r.action).toBe('none');
    expect(r.next.since).toBe(iso(-500));
  });

  it('пустое состояние и успех — штатно, без действий', () => {
    expect(decideTelegramEgress(null, OK, at(0))).toEqual({
      next: { status: 'ok', since: iso(0), failStreak: 0 },
      action: 'none',
    });
  });
});

describe('текст для писем и сообщений', () => {
  it('простой: минуты и часы', () => {
    expect(formatTelegramDowntime(iso(0), at(45))).toBe('45 мин');
    expect(formatTelegramDowntime(iso(0), at(125))).toBe('2 ч 5 мин');
  });

  it('учётные данные прокси маскируются', () => {
    expect(cleanTelegramError('Proxy http://user:secret@10.0.0.1:3128 refused')).not.toContain('secret');
  });
});
