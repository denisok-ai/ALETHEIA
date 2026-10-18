import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getConfiguredReviewToken,
  isSafeMediaName,
  isValidReviewToken,
  mediaContentType,
  mediaFilePath,
  parseByteRange,
  parseDecisions,
  parseReviewItems,
  resolveReviewDir,
  reviewNotificationLines,
  validateDecisionInput,
} from '@/lib/content-review';

const TOKEN = 'a'.repeat(32);
const NAME = '0123456789abcdef0123456789abcdef';

describe('getConfiguredReviewToken', () => {
  it('короче 32 символов — токен не задан', () => {
    expect(getConfiguredReviewToken({ CONTENT_REVIEW_TOKEN: 'x'.repeat(31) })).toBeNull();
    expect(getConfiguredReviewToken({})).toBeNull();
  });

  it('32 и больше символов — возвращает токен', () => {
    expect(getConfiguredReviewToken({ CONTENT_REVIEW_TOKEN: TOKEN })).toBe(TOKEN);
  });
});

describe('isValidReviewToken', () => {
  it('совпадение — true', () => {
    expect(isValidReviewToken(TOKEN, TOKEN)).toBe(true);
  });

  it('другой токен той же длины — false', () => {
    expect(isValidReviewToken('b'.repeat(32), TOKEN)).toBe(false);
  });

  it('другая длина — false, без исключений', () => {
    expect(isValidReviewToken('a'.repeat(31), TOKEN)).toBe(false);
    expect(isValidReviewToken(TOKEN + 'a', TOKEN)).toBe(false);
  });

  it('не заданный или короткий ожидаемый токен никогда не проходит', () => {
    expect(isValidReviewToken('', null)).toBe(false);
    expect(isValidReviewToken(undefined, TOKEN)).toBe(false);
    expect(isValidReviewToken('short', 'short')).toBe(false);
  });
});

describe('isSafeMediaName / mediaFilePath', () => {
  it('принимает 32 hex и допустимые расширения', () => {
    expect(isSafeMediaName(`${NAME}.mp4`)).toBe(true);
    expect(isSafeMediaName(`${NAME}.jpg`)).toBe(true);
    expect(isSafeMediaName(`${NAME}.jpeg`)).toBe(true);
    expect(isSafeMediaName(`${NAME}.png`)).toBe(true);
  });

  it('отвергает обход каталога, слеши, верхний регистр и чужие расширения', () => {
    expect(isSafeMediaName('../x')).toBe(false);
    expect(isSafeMediaName(`../${NAME}.mp4`)).toBe(false);
    expect(isSafeMediaName(`sub/${NAME}.mp4`)).toBe(false);
    expect(isSafeMediaName(`${NAME}.MP4`)).toBe(false);
    expect(isSafeMediaName(NAME.toUpperCase() + '.mp4')).toBe(false);
    expect(isSafeMediaName(`${NAME}.mp4.exe`)).toBe(false);
    expect(isSafeMediaName(`${NAME}.gif`)).toBe(false);
    expect(isSafeMediaName(`${NAME.slice(1)}.mp4`)).toBe(false);
    expect(isSafeMediaName(undefined)).toBe(false);
    expect(isSafeMediaName(42)).toBe(false);
  });

  it('путь строго внутри media/', () => {
    const dir = '/srv/review';
    expect(mediaFilePath(dir, `${NAME}.mp4`)).toBe(path.join(dir, 'media', `${NAME}.mp4`));
    expect(mediaFilePath(dir, '../x')).toBeNull();
    expect(mediaFilePath(dir, '..')).toBeNull();
  });

  it('Content-Type по расширению', () => {
    expect(mediaContentType(`${NAME}.mp4`)).toBe('video/mp4');
    expect(mediaContentType(`${NAME}.png`)).toBe('image/png');
    expect(mediaContentType(`${NAME}.jpg`)).toBe('image/jpeg');
    expect(mediaContentType(`${NAME}.jpeg`)).toBe('image/jpeg');
  });
});

describe('parseByteRange', () => {
  const size = 1000;

  it('без заголовка или пустого файла — целиком', () => {
    expect(parseByteRange(null, size)).toEqual({ kind: 'full' });
    expect(parseByteRange('bytes=0-99', 0)).toEqual({ kind: 'full' });
  });

  it('bytes=a-b', () => {
    expect(parseByteRange('bytes=0-99', size)).toEqual({ kind: 'partial', start: 0, end: 99 });
  });

  it('bytes=a- — до конца файла', () => {
    expect(parseByteRange('bytes=900-', size)).toEqual({ kind: 'partial', start: 900, end: 999 });
  });

  it('bytes=-n — последние n байт', () => {
    expect(parseByteRange('bytes=-100', size)).toEqual({ kind: 'partial', start: 900, end: 999 });
    expect(parseByteRange('bytes=-5000', size)).toEqual({ kind: 'partial', start: 0, end: 999 });
  });

  it('конец за пределами файла обрезается', () => {
    expect(parseByteRange('bytes=0-5000', size)).toEqual({ kind: 'partial', start: 0, end: 999 });
  });

  it('старт за пределами файла — 416', () => {
    expect(parseByteRange('bytes=1000-', size)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=-0', size)).toEqual({ kind: 'unsatisfiable' });
  });

  it('нераспознанное или множественное значение игнорируется', () => {
    expect(parseByteRange('bytes=5-2', size)).toEqual({ kind: 'full' });
    expect(parseByteRange('bytes=0-1,5-6', size)).toEqual({ kind: 'full' });
    expect(parseByteRange('items=0-1', size)).toEqual({ kind: 'full' });
    expect(parseByteRange('bytes=-', size)).toEqual({ kind: 'full' });
  });
});

describe('parseReviewItems', () => {
  it('не массив — пустой план', () => {
    expect(parseReviewItems(null)).toEqual([]);
    expect(parseReviewItems({ id: 'x' })).toEqual([]);
  });

  it('пропускает записи без id и дубли', () => {
    const items = parseReviewItems([
      { title: 'без id' },
      { id: 'a', title: 'первый', kind: 'text' },
      { id: 'a', title: 'дубль', kind: 'text' },
      null,
    ]);
    expect(items.map((i) => i.id)).toEqual(['a']);
    expect(items[0].title).toBe('первый');
  });

  it('отбрасывает небезопасные имена медиа и некорректные даты', () => {
    const [item] = parseReviewItems([
      {
        id: 'v1',
        kind: 'video-candidate',
        date: '2026-13-45x',
        video: '../../etc/passwd',
        poster: `${NAME}.jpg`,
      },
    ]);
    expect(item.video).toBeUndefined();
    expect(item.poster).toBe(`${NAME}.jpg`);
    expect(item.date).toBeNull();
  });

  it('сортирует по дате, затем по order; без даты — в конец', () => {
    const items = parseReviewItems([
      { id: 'nodate', order: 1 },
      { id: 'late', date: '2026-10-25', order: 1 },
      { id: 'early2', date: '2026-10-20', order: 2 },
      { id: 'early1', date: '2026-10-20', order: 1 },
    ]);
    expect(items.map((i) => i.id)).toEqual(['early1', 'early2', 'late', 'nodate']);
  });

  it('списки и поля по умолчанию', () => {
    const [item] = parseReviewItems([{ id: 't' }]);
    expect(item.notes).toEqual([]);
    expect(item.risks).toEqual([]);
    expect(item.titleVariants).toEqual([]);
    expect(item.body).toBe('');
    expect(item.speech).toBeUndefined();
  });
});

describe('parseDecisions', () => {
  it('пустое или битое значение — пустой набор', () => {
    expect(parseDecisions(null)).toEqual({});
    expect(parseDecisions('')).toEqual({});
    expect(parseDecisions('{не json')).toEqual({});
    expect(parseDecisions('[1,2]')).toEqual({});
  });

  it('оставляет только корректные решения', () => {
    const out = parseDecisions(
      JSON.stringify({
        ok: { status: 'approved', title: 'T', body: 'B', comment: 'C', updatedAt: '2026-10-18T10:00:00.000Z' },
        bad: { status: 'maybe', title: 'T' },
        empty: null,
      }),
    );
    expect(Object.keys(out)).toEqual(['ok']);
    expect(out.ok.status).toBe('approved');
  });
});

describe('validateDecisionInput', () => {
  const base = { id: 'a', status: 'changes', title: '  Заголовок  ', body: 'текст', comment: ' да ' };

  it('принимает корректное решение и обрезает заголовок и комментарий', () => {
    const r = validateDecisionInput(base);
    expect(r).toEqual({
      ok: true,
      value: { id: 'a', status: 'changes', title: 'Заголовок', body: 'текст', comment: 'да' },
    });
  });

  it('speech опционален, но если передан — проверяется длина', () => {
    const ok = validateDecisionInput({ ...base, speech: 'речь' });
    expect(ok.ok && ok.value.speech).toBe('речь');
    expect(validateDecisionInput({ ...base, speech: 'я'.repeat(3001) }).ok).toBe(false);
    expect(validateDecisionInput({ ...base, speech: 5 }).ok).toBe(false);
  });

  it('отвергает неизвестный статус и пустой id', () => {
    expect(validateDecisionInput({ ...base, status: 'approve' }).ok).toBe(false);
    expect(validateDecisionInput({ ...base, id: '' }).ok).toBe(false);
    expect(validateDecisionInput({ ...base, id: 7 }).ok).toBe(false);
  });

  it('лимиты длины: title 300, body 6000, comment 2000', () => {
    expect(validateDecisionInput({ ...base, title: 'я'.repeat(300) }).ok).toBe(true);
    expect(validateDecisionInput({ ...base, title: 'я'.repeat(301) }).ok).toBe(false);
    expect(validateDecisionInput({ ...base, body: 'x'.repeat(6001) }).ok).toBe(false);
    expect(validateDecisionInput({ ...base, comment: 'x'.repeat(2001) }).ok).toBe(false);
  });

  it('пустой заголовок (после обрезки) отвергается', () => {
    expect(validateDecisionInput({ ...base, title: '   ' }).ok).toBe(false);
  });

  it('не объект — отвергается', () => {
    expect(validateDecisionInput(null).ok).toBe(false);
    expect(validateDecisionInput([]).ok).toBe(false);
    expect(validateDecisionInput('строка').ok).toBe(false);
  });
});

describe('reviewNotificationLines', () => {
  it('статус и название; комментарий обрезается', () => {
    const lines = reviewNotificationLines('Заголовок', 'rejected', 'к'.repeat(400));
    expect(lines[0]).toBe('«Заголовок»: Отклонено');
    expect(lines[1].startsWith('Комментарий: ')).toBe(true);
    expect(lines[1].length).toBeLessThan(330);
  });

  it('без комментария — одна строка', () => {
    expect(reviewNotificationLines('T', 'approved', '')).toEqual(['«T»: Согласовано']);
  });
});

describe('resolveReviewDir', () => {
  it('по умолчанию — private/review внутри проекта', () => {
    expect(resolveReviewDir({}, '/app')).toBe(path.join('/app', 'private', 'review'));
  });

  it('CONTENT_REVIEW_DIR имеет приоритет', () => {
    expect(resolveReviewDir({ CONTENT_REVIEW_DIR: '/srv/review' }, '/app')).toBe(path.resolve('/srv/review'));
  });
});
