/**
 * Чистые модули автоворонки Telegram-бота: разбор deep-link, подпись ссылок
 * оффера, детекторы интента/возражений/аудитории, команда отписки.
 * Ни БД, ни сети — каждый кейс воспроизводит реальную находку аудита.
 */
import { describe, expect, it } from 'vitest';
import { buildStartPayload, hasStartPayload, parseStartPayload, sanitizeSource } from '@/lib/telegram-bot/deep-link';
import { buildTrackedOfferUrl, signOfferLink, verifyOfferLink } from '@/lib/telegram-bot/offer-link';
import { detectBuyIntent } from '@/lib/telegram-bot/buy-intent';
import { detectObjection, OBJECTION_LABEL, OBJECTION_REPLY } from '@/lib/telegram-bot/objection';
import { detectAudience } from '@/lib/telegram-bot/audience';
import { isUnsubscribeCommand } from '@/lib/telegram-bot/unsubscribe';
import { sourceLines } from '@/lib/telegram-bot/funnel-stats';

describe('deep-link: /start payload', () => {
  it('разбирает источник и id лида вместе и по отдельности', () => {
    expect(parseStartPayload('s-blog_l-42')).toMatchObject({ entrySource: 'blog', leadId: 42 });
    expect(parseStartPayload('s-contacts')).toMatchObject({ entrySource: 'contacts' });
    expect(parseStartPayload('l-7').leadId).toBe(7);
  });

  it('отвергает мусор и невалидные id — без исключений', () => {
    for (const raw of ['l--5', 'l-abc', '<script>', '', undefined, null, 'l-99999999999999999999']) {
      const p = parseStartPayload(raw as string | null | undefined);
      expect(p.leadId === undefined || (Number.isSafeInteger(p.leadId) && p.leadId <= 2_147_483_647)).toBe(true);
    }
    expect(hasStartPayload(parseStartPayload('<script>'))).toBe(false);
  });

  it('build → parse — обратимо', () => {
    const payload = buildStartPayload({ source: 'faq', leadId: 15 });
    expect(parseStartPayload(payload)).toMatchObject({ entrySource: 'faq', leadId: 15 });
  });

  it('sanitizeSource оставляет только безопасные символы', () => {
    expect(sanitizeSource('blog/<b>x</b>')).not.toMatch(/[<>/]/);
  });
});

describe('offer-link: подпись HMAC', () => {
  it('своя подпись верна, чужой leadId/slug/пустая/обрезанная — нет', () => {
    const sig = signOfferLink(100, 'praktik');
    expect(verifyOfferLink(100, 'praktik', sig)).toBe(true);
    expect(verifyOfferLink(101, 'praktik', sig)).toBe(false);
    expect(verifyOfferLink(100, 'master', sig)).toBe(false);
    expect(verifyOfferLink(100, 'praktik', '')).toBe(false);
    expect(verifyOfferLink(100, 'praktik', sig.slice(0, 8) + '00000000')).toBe(false);
  });

  it('трекинговая ссылка содержит lead, slug и подпись', () => {
    const url = buildTrackedOfferUrl('https://avaterra.pro', 5, 'praktik');
    expect(url).toContain('/api/r/offer?');
    expect(url).toContain('l=5');
    expect(url).toContain('s=praktik');
    expect(url).toMatch(/t=[0-9a-f]{16}/);
  });
});

describe('buy-intent: сигналы покупки', () => {
  it('цена + рассрочка в одном сообщении', () => {
    const i = detectBuyIntent('сколько стоит и есть ли рассрочка?');
    expect(i?.topics).toEqual(expect.arrayContaining(['price', 'installment']));
  });

  it('обычный вопрос — не интент', () => {
    expect(detectBuyIntent('Нужен ли партнёр для практики?')).toBeNull();
    expect(detectBuyIntent('спасибо большое')).toBeNull();
  });

  it('«записаться» → enroll', () => {
    expect(detectBuyIntent('хочу записаться на курс')?.topics).toContain('enroll');
  });
});

describe('objection: возражения после оффера', () => {
  it('цена / время / потом / сомнения / недоверие / не подходит', () => {
    expect(detectObjection('дорого для меня')).toBe('price');
    expect(detectObjection('нет времени сейчас')).toBe('time');
    expect(detectObjection('давайте позже')).toBe('later');
    expect(detectObjection('надо подумать')).toBe('doubt');
    expect(detectObjection('а это не обман?')).toBe('trust');
    expect(detectObjection('это не для меня')).toBe('fit');
  });

  it('личная ситуация «развод» — не возражение-недоверие (находка аудита)', () => {
    expect(detectObjection('у меня развод, тяжело')).not.toBe('trust');
  });
});

describe('audience: сегмент по тексту', () => {
  it('распознаёт телесный запрос и специалиста', () => {
    expect(detectAudience('постоянно болит спина и напряжение в плечах')).toBe('tense_body');
    expect(detectAudience('я психолог, хочу инструмент для клиентов')).toBe('specialist');
  });

  it('нейтральный текст — null', () => {
    expect(detectAudience('добрый день')).toBeNull();
  });
});

describe('unsubscribe: команда «стоп»', () => {
  it('стоп/отписаться в разных формах', () => {
    expect(isUnsubscribeCommand('стоп')).toBe(true);
    expect(isUnsubscribeCommand('СТОП!')).toBe(true);
    expect(isUnsubscribeCommand('отписаться')).toBe(true);
  });

  it('обычное слово не считается отпиской', () => {
    expect(isUnsubscribeCommand('остановите боль в спине')).toBe(false);
  });
});

describe('funnel-stats: точки входа', () => {
  it('пусто — без секции; иначе топ с квалифицированными', () => {
    expect(sourceLines([])).toEqual([]);
    const lines = sourceLines([
      { source: 'blog-lobnyy-obhvat', count: 3, qualified: 1 },
      { source: 'без метки', count: 1, qualified: 0 },
    ]);
    expect(lines.join('\n')).toContain('blog-lobnyy-obhvat: 3 (квалиф. 1)');
    expect(lines.join('\n')).toContain('без метки: 1');
  });
});

describe('objection: подсказки менеджеру', () => {
  it('подсказка есть для каждого типа и соблюдает правила школы (без сумм и обещаний)', () => {
    for (const t of Object.keys(OBJECTION_LABEL) as Array<keyof typeof OBJECTION_REPLY>) {
      const r = OBJECTION_REPLY[t];
      expect(r.length, t).toBeGreaterThan(30);
      expect(r, t).not.toMatch(/\d[\d ]*₽|вылечи|гарантир/i);
    }
  });
});
