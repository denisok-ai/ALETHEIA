/**
 * Метка ?ref= в payload /start бота: кодирование, разбор и лимит 64 символа.
 * Старые payload (без r-части) обязаны разбираться как раньше.
 */
import { describe, expect, it } from 'vitest';
import { buildStartPayload, hasStartPayload, parseStartPayload } from '@/lib/telegram-bot/deep-link';
import { botDeepLink, TELEGRAM_BOT_URL } from '@/lib/social-links';

describe('start payload: ref-сегмент', () => {
  it('кодирует метку без дефиса: tg-01 → rtg01', () => {
    expect(buildStartPayload({ source: 'blog', ref: 'tg-01' })).toBe('s-blog_rtg01');
    expect(buildStartPayload({ ref: 'vk-003' })).toBe('rvk003');
  });

  it('round-trip: build → parse возвращает те же source, leadId и ref', () => {
    const payload = buildStartPayload({ source: 'site-footer', leadId: 42, ref: 'dz-12' });
    expect(payload).toBe('s-site-footer_l-42_rdz12');
    expect(parseStartPayload(payload)).toEqual({ entrySource: 'site-footer', leadId: 42, ref: 'dz-12' });
  });

  it('старые payload разбираются без поля ref', () => {
    expect(parseStartPayload('s-blog_l-42')).toEqual({ entrySource: 'blog', leadId: 42 });
    expect(parseStartPayload('s-contacts')).toEqual({ entrySource: 'contacts' });
    expect(parseStartPayload('l-7')).toEqual({ leadId: 7 });
    expect(parseStartPayload('write')).toEqual({});
  });

  it('старые payload собираются байт в байт как раньше', () => {
    expect(buildStartPayload({ source: 'faq', leadId: 15 })).toBe('s-faq_l-15');
    expect(buildStartPayload({ source: 'faq' })).toBe('s-faq');
    expect(buildStartPayload({})).toBe('');
  });

  it('невалидная метка игнорируется и при сборке, и при разборе', () => {
    expect(buildStartPayload({ source: 'chat', ref: 'tg-1' })).toBe('s-chat');
    expect(buildStartPayload({ source: 'chat', ref: 'TG-01' })).toBe('s-chat');
    expect(buildStartPayload({ source: 'chat', ref: '<tg-01>' })).toBe('s-chat');
    expect(buildStartPayload({ source: 'chat', ref: null })).toBe('s-chat');
    expect(buildStartPayload({ source: 'chat', ref: 'xx-01' })).toBe('s-chat');
    expect(parseStartPayload('s-chat_rtg1').ref).toBeUndefined();
    expect(parseStartPayload('s-chat_rTG01').ref).toBeUndefined();
    expect(parseStartPayload('s-chat_rxx01').ref).toBeUndefined();
    expect(parseStartPayload('s-chat_rtg0123').ref).toBeUndefined();
  });

  it('метка одна: ref без source и leadId тоже делает payload значимым', () => {
    const parsed = parseStartPayload('rtg01');
    expect(parsed).toEqual({ ref: 'tg-01' });
    expect(hasStartPayload(parsed)).toBe(true);
    expect(hasStartPayload(parseStartPayload('zz_yy'))).toBe(false);
  });

  it('максимальный набор (source 32 + leadId + ref) укладывается в 64 символа целиком', () => {
    // 34 (s-…32) + 1 + 13 (l-1234567890) + 1 + 5 (rtg01) = 54.
    const full = buildStartPayload({ source: 'a'.repeat(32), leadId: 1234567890, ref: 'tg-01' });
    expect(full.length).toBeLessThanOrEqual(64);
    expect(full.endsWith('_rtg01')).toBe(true);
  });

  it('никогда не возвращает payload длиннее 64 символов', () => {
    for (let id = 1; id < 100000; id *= 7) {
      const p = buildStartPayload({ source: 'c'.repeat(40), leadId: id, ref: 'rt-123' });
      expect(p.length).toBeLessThanOrEqual(64);
      expect(/^[A-Za-z0-9_-]*$/.test(p)).toBe(true);
    }
  });
});

describe('botDeepLink с меткой', () => {
  it('без метки ссылка прежняя', () => {
    expect(botDeepLink('faq')).toBe(`${TELEGRAM_BOT_URL}?start=s-faq`);
    expect(botDeepLink('faq', { ref: null })).toBe(`${TELEGRAM_BOT_URL}?start=s-faq`);
  });

  it('с меткой добавляет сегмент rtg01', () => {
    expect(botDeepLink('landing', { ref: 'tg-01' })).toBe(`${TELEGRAM_BOT_URL}?start=s-landing_rtg01`);
  });
});
