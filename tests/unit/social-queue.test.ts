/**
 * Очередь соцсетей: каталог файлов, МСК-время, день по Москве, разбор файла очереди.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SOCIAL_MEDIA_DIR, resolveSocialMediaPath } from '@/lib/social/media-path';
import { formatMsk, mskDayBounds } from '@/lib/social/moscow-day';
import { parseQueueInput, parseScheduledAt } from '@/lib/social/queue-input';

const DIR = DEFAULT_SOCIAL_MEDIA_DIR;

describe('resolveSocialMediaPath', () => {
  it('файл внутри каталога — абсолютный путь внутри каталога', () => {
    expect(resolveSocialMediaPath('clip-01.mp4', DIR)).toBe(`${DIR}/clip-01.mp4`);
    expect(resolveSocialMediaPath('vertical/clip-01.mp4', DIR)).toBe(`${DIR}/vertical/clip-01.mp4`);
  });

  it('абсолютный путь внутри каталога допустим', () => {
    expect(resolveSocialMediaPath(`${DIR}/clip.mp4`, DIR)).toBe(`${DIR}/clip.mp4`);
  });

  it('«..» отклоняется, в том числе в середине пути', () => {
    expect(() => resolveSocialMediaPath('../secret.env', DIR)).toThrow('..');
    expect(() => resolveSocialMediaPath('a/../../etc/passwd', DIR)).toThrow('..');
    expect(() => resolveSocialMediaPath('a\\..\\b.mp4', DIR)).toThrow('..');
  });

  it('абсолютный путь вне каталога отклоняется', () => {
    expect(() => resolveSocialMediaPath('/etc/passwd', DIR)).toThrow('вне каталога');
    expect(() => resolveSocialMediaPath('/opt/ALETHEIA/.env', DIR)).toThrow('вне каталога');
  });

  it('пустое значение и нулевой байт отклоняются', () => {
    expect(() => resolveSocialMediaPath('   ', DIR)).toThrow();
    expect(() => resolveSocialMediaPath('a\0b.mp4', DIR)).toThrow();
  });
});

describe('mskDayBounds: календарный день по Москве', () => {
  it('23:59 МСК (20:59 UTC) принадлежит ещё предыдущему дню', () => {
    const { start, end } = mskDayBounds(new Date('2026-10-13T20:59:59Z'));
    expect(start.toISOString()).toBe('2026-10-12T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('00:00 МСК (21:00 UTC) — уже новый день', () => {
    const { start, end } = mskDayBounds(new Date('2026-10-13T21:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-13T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-14T21:00:00.000Z');
  });

  it('границы дня полуинтервалом: конец не входит', () => {
    const { start, end } = mskDayBounds(new Date('2026-10-14T08:00:00Z'));
    expect(new Date('2026-10-14T08:00:00Z') >= start && new Date('2026-10-14T08:00:00Z') < end).toBe(true);
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
  });

  it('formatMsk показывает московское время', () => {
    expect(formatMsk(new Date('2026-10-14T07:05:00Z'))).toBe('14.10.2026 10:05 МСК');
  });
});

describe('parseScheduledAt', () => {
  it('без смещения — московское время', () => {
    expect(parseScheduledAt('2026-10-14 10:00')?.toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(parseScheduledAt('2026-10-14T10:00')?.toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(parseScheduledAt('2026-10-14 10:00:30')?.toISOString()).toBe('2026-10-14T07:00:30.000Z');
  });

  it('с явным смещением — как записано', () => {
    expect(parseScheduledAt('2026-10-14T10:00:00+03:00')?.toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(parseScheduledAt('2026-10-14T07:00:00Z')?.toISOString()).toBe('2026-10-14T07:00:00.000Z');
  });

  it('прочие форматы и пустая строка — null', () => {
    expect(parseScheduledAt('14.10.2026 10:00')).toBeNull();
    expect(parseScheduledAt('завтра')).toBeNull();
    expect(parseScheduledAt('')).toBeNull();
  });
});

describe('parseQueueInput', () => {
  const ok = {
    file: 'clip-01.mp4',
    title: 'Заголовок',
    body: 'Текст',
    ref: 'tg-01',
    scheduledAt: '2026-10-14 10:00',
  };

  it('корректная запись проходит и получает Date', () => {
    const r = parseQueueInput([ok], { mediaDir: DIR });
    expect(r.errors).toEqual([]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].scheduledAt.toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(r.entries[0].ref).toBe('tg-01');
  });

  it('очередь MAX принимает только метки mx-, очередь Telegram — только tg-', () => {
    const mx = { ...ok, ref: 'mx-01' };
    expect(parseQueueInput([mx], { mediaDir: DIR, networkCode: 'max' }).errors).toEqual([]);
    expect(parseQueueInput([ok], { mediaDir: DIR, networkCode: 'max' }).errors[0]).toContain('MAX вида mx-01');
    expect(parseQueueInput([mx], { mediaDir: DIR }).errors[0]).toContain('Telegram вида tg-01');
  });

  it('не массив и пустой массив — ошибка', () => {
    expect(parseQueueInput({ file: 'x' }, { mediaDir: DIR }).errors).toHaveLength(1);
    expect(parseQueueInput([], { mediaDir: DIR }).errors).toEqual(['очередь пуста']);
  });

  it('путь наружу каталога, пустой title, чужая сеть в метке, плохое время — ошибки по записям', () => {
    const r = parseQueueInput(
      [
        { ...ok, file: '../secret.mp4' },
        { ...ok, ref: 'vk-01' },
        { ...ok, title: '' },
        { ...ok, ref: 'tg-02', scheduledAt: 'когда-нибудь' },
      ],
      { mediaDir: DIR },
    );
    expect(r.entries).toEqual([]);
    expect(r.errors.some((e) => e.startsWith('запись 1') && e.includes('..'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('запись 2') && e.includes('vk-01'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('запись 3') && e.includes('title'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('запись 4') && e.includes('scheduledAt'))).toBe(true);
  });

  it('повтор метки внутри файла — ошибка', () => {
    const r = parseQueueInput([ok, { ...ok, file: 'clip-02.mp4' }], { mediaDir: DIR });
    expect(r.errors.some((e) => e.includes('повторяется'))).toBe(true);
  });
});

describe('parseQueueInput: текстовые посты без file', () => {
  const text = {
    title: 'Вопрос недели',
    body: 'Текст текстового поста.',
    ref: 'tg-02',
    scheduledAt: '2026-10-14 10:00',
  };

  it('запись без file — текстовый пост: entry.file = null, body сохранён', () => {
    const r = parseQueueInput([text], { mediaDir: DIR });
    expect(r.errors).toEqual([]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].file).toBeNull();
    expect(r.entries[0].body).toBe('Текст текстового поста.');
  });

  it('пустой file трактуется как отсутствующий', () => {
    const r = parseQueueInput([{ ...text, file: '  ' }], { mediaDir: DIR });
    expect(r.errors).toEqual([]);
    expect(r.entries[0].file).toBeNull();
  });

  it('текстовый пост без body — ошибка: текста нет', () => {
    const r = parseQueueInput([{ ...text, body: '' }], { mediaDir: DIR });
    expect(r.entries).toEqual([]);
    expect(r.errors[0]).toContain('нужен body');
  });

  it('видео с file по-прежнему проверяет путь, даже при наличии body', () => {
    const r = parseQueueInput([{ ...text, file: '../secret.mp4' }], { mediaDir: DIR });
    expect(r.entries).toEqual([]);
    expect(r.errors[0]).toContain('..');
  });

  it('текстовый и видео-посты в одной очереди', () => {
    const video = { ...text, file: 'clip-01.mp4', ref: 'tg-01' };
    const r = parseQueueInput([video, text], { mediaDir: DIR });
    expect(r.errors).toEqual([]);
    expect(r.entries.map((e) => e.file)).toEqual(['clip-01.mp4', null]);
  });
});
