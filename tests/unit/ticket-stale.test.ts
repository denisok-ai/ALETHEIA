/**
 * Тикеты, ждущие человека (инцидент 26–27.11.2026: автоответ «уточним и вернёмся»,
 * сутки тишины, клиентка «Вы не забыли обо мне?»).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

import { parseTicketMessages, waitingSince, type TicketMessage } from '@/lib/ticket-stale';

const u = (at: string, content = 'вопрос'): TicketMessage => ({ role: 'user', content, at });
const m = (at: string, auto?: boolean): TicketMessage => ({ role: 'manager', content: 'ответ', at, auto });

describe('waitingSince', () => {
  it('реальный кейс: вопрос, автоответ через секунды (старый, без флага), напоминание клиента — ждёт с напоминания', () => {
    const msgs = [
      u('2026-11-26T17:38:13Z'),
      m('2026-11-26T17:38:14Z'),
      u('2026-11-27T11:04:00Z', 'Вы не забыли обо мне?'),
    ];
    expect(waitingSince(msgs)?.toISOString()).toBe('2026-11-27T11:04:00.000Z');
  });

  it('только автоответ (флаг auto) — всё ещё ждёт человека', () => {
    const msgs = [u('2026-11-28T08:00:00Z'), m('2026-11-28T08:10:00Z', true)];
    expect(waitingSince(msgs)?.toISOString()).toBe('2026-11-28T08:00:00.000Z');
  });

  it('старый автоответ без флага в пределах 2 минут считается автоматическим', () => {
    expect(waitingSince([u('2026-11-28T08:00:00Z'), m('2026-11-28T08:01:30Z')])).not.toBeNull();
  });

  it('ответ человека после последнего сообщения клиента — не ждёт', () => {
    expect(waitingSince([u('2026-11-28T08:00:00Z'), m('2026-11-28T09:00:00Z')])).toBeNull();
    expect(waitingSince([u('2026-11-28T08:00:00Z'), m('2026-11-28T08:00:30Z', false)])).toBeNull();
  });

  it('пусто или только поддержка — не ждёт', () => {
    expect(waitingSince([])).toBeNull();
    expect(waitingSince([m('2026-11-28T08:00:00Z')])).toBeNull();
  });
});

describe('parseTicketMessages', () => {
  it('строка JSON из SQLite и мусор', () => {
    expect(parseTicketMessages('[{"role":"user","content":"a","at":"2026-11-28T08:00:00Z"}]')).toHaveLength(1);
    expect(parseTicketMessages('не json')).toEqual([]);
    expect(parseTicketMessages(null)).toEqual([]);
  });
});
