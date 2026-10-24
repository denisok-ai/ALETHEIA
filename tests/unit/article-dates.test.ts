/**
 * Даты статьи блога: dateModified, modifiedTime и строка «Обновлено».
 */
import { describe, expect, it } from 'vitest';
import { articleDates, formatArticleDate, UPDATED_NOTICE_MIN_GAP_MS } from '@/lib/content/article-dates';

const PUBLISHED = '2026-10-10T09:00:00Z';

describe('articleDates: дата правки статьи', () => {
  it('без правок — дата публикации, «Обновлено» не показываем', () => {
    expect(articleDates({ publishedAt: PUBLISHED })).toEqual({
      published: '2026-10-10T09:00:00.000Z',
      modified: '2026-10-10T09:00:00.000Z',
      showUpdated: false,
    });
  });

  it('переработка из KB_REVISED позже публикации — берём её (полдень МСК), показываем', () => {
    const d = articleDates({ publishedAt: PUBLISHED, kbRevised: '2026-10-18' });
    expect(d.modified).toBe('2026-10-18T09:00:00.000Z');
    expect(d.showUpdated).toBe(true);
  });

  it('updatedAt из БД позже ревизии — берём updatedAt', () => {
    const d = articleDates({
      publishedAt: PUBLISHED,
      kbRevised: '2026-10-12',
      updatedAt: '2026-10-20T10:00:00Z',
    });
    expect(d.modified).toBe('2026-10-20T10:00:00.000Z');
    expect(d.showUpdated).toBe(true);
  });

  it('ревизия старше публикации не откатывает дату назад', () => {
    const d = articleDates({ publishedAt: '2026-10-20T09:00:00Z', kbRevised: '2026-10-18' });
    expect(d.modified).toBe('2026-10-20T09:00:00.000Z');
    expect(d.showUpdated).toBe(false);
  });

  it('служебная правка через час после публикации — dateModified есть, «Обновлено» не показываем', () => {
    const d = articleDates({ publishedAt: PUBLISHED, updatedAt: '2026-10-10T10:00:00Z' });
    expect(d.modified).toBe('2026-10-10T10:00:00.000Z');
    expect(d.showUpdated).toBe(false);
  });

  it('порог «больше суток»: ровно сутки — не показываем, на минуту больше — показываем', () => {
    const exact = new Date(Date.parse(PUBLISHED) + UPDATED_NOTICE_MIN_GAP_MS).toISOString();
    const more = new Date(Date.parse(PUBLISHED) + UPDATED_NOTICE_MIN_GAP_MS + 60_000).toISOString();
    expect(articleDates({ publishedAt: PUBLISHED, updatedAt: exact }).showUpdated).toBe(false);
    expect(articleDates({ publishedAt: PUBLISHED, updatedAt: more }).showUpdated).toBe(true);
  });

  it('нечитаемые даты игнорируются', () => {
    const d = articleDates({ publishedAt: PUBLISHED, kbRevised: 'не дата', updatedAt: 'вчера' });
    expect(d.modified).toBe('2026-10-10T09:00:00.000Z');
    expect(d.showUpdated).toBe(false);
  });

  it('updatedAt как Date и null', () => {
    expect(articleDates({ publishedAt: new Date(PUBLISHED), updatedAt: null }).published).toBe(
      '2026-10-10T09:00:00.000Z'
    );
    const d = articleDates({ publishedAt: PUBLISHED, updatedAt: new Date('2026-10-15T09:00:00Z') });
    expect(d.modified).toBe('2026-10-15T09:00:00.000Z');
  });
});

describe('formatArticleDate: дата на странице статьи', () => {
  it('в том же виде, что и раньше у даты публикации', () => {
    expect(formatArticleDate('2026-10-18T12:00:00Z')).toBe('18 октября 2026 г.');
  });
});
