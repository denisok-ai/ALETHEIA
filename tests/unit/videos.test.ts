/**
 * Каталог роликов школы (T4.4): валидность метаданных, JSON-LD VideoObject, правила текстов.
 */
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { scanPublishBlockers } from '@/lib/content/quality-gates';
import { titleProblems } from '@/lib/social/captions';
import {
  VIDEO_CLIPS,
  buildVideoObject,
  clipPosterSrc,
  clipSrc,
  getClipsForPlacement,
} from '@/lib/content/videos';

const BASE = 'https://avaterra.pro';
const ISO_WITH_MSK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/;
const PRICE_OR_PROMISE = /₽|руб|цен[аеуы]|стоимост|лечит|вылеч|гарант|диагноз/i;

describe('каталог роликов', () => {
  it('slug уникальны и непусты', () => {
    const slugs = VIDEO_CLIPS.map((c) => c.slug);
    expect(slugs.every((s) => s.length > 0)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('файлы и постеры уникальны и без путей', () => {
    const files = VIDEO_CLIPS.map((c) => c.file);
    const posters = VIDEO_CLIPS.map((c) => c.poster);
    expect(new Set(files).size).toBe(files.length);
    expect(new Set(posters).size).toBe(posters.length);
    for (const f of files) {
      expect(f).toMatch(/^[\w.-]+\.mp4$/);
    }
    for (const p of posters) {
      expect(p).toMatch(/^[\w-]+$/);
    }
  });

  it('длительность 20–65 секунд, формат 9:16', () => {
    for (const c of VIDEO_CLIPS) {
      expect(Number.isInteger(c.durationSec)).toBe(true);
      expect(c.durationSec).toBeGreaterThanOrEqual(20);
      expect(c.durationSec).toBeLessThanOrEqual(65);
      expect(c.width / c.height).toBeCloseTo(9 / 16, 2);
    }
  });

  it('uploadDate в ISO 8601 с +03:00 и парсится', () => {
    for (const c of VIDEO_CLIPS) {
      expect(c.uploadDate).toMatch(ISO_WITH_MSK);
      expect(Number.isNaN(Date.parse(c.uploadDate))).toBe(false);
    }
  });

  it('placements ссылаются на practicum или существующий термин глоссария', () => {
    const termSlugs = new Set(GLOSSARY_TERMS.map((t) => t.slug));
    for (const c of VIDEO_CLIPS) {
      expect(c.placements.length).toBeGreaterThan(0);
      for (const p of c.placements) {
        expect(p === 'practicum' || termSlugs.has(p), `${c.slug}: placement «${p}»`).toBe(true);
      }
    }
  });

  it('на лендинг практикума попадает хотя бы один ролик', () => {
    expect(getClipsForPlacement('practicum').length).toBeGreaterThan(0);
    expect(getClipsForPlacement('no-such-term')).toEqual([]);
  });
});

describe('JSON-LD VideoObject', () => {
  it('строится с абсолютными URL и ISO-длительностью', () => {
    for (const c of VIDEO_CLIPS) {
      const ld = buildVideoObject(c, `${BASE}/`);
      expect(ld['@type']).toBe('VideoObject');
      expect(ld.name).toBe(c.title);
      expect(ld.duration).toMatch(/^PT\d+S$/);
      expect(ld.duration).toBe(`PT${c.durationSec}S`);
      expect(ld.contentUrl).toBe(`${BASE}${clipSrc(c)}`);
      expect(ld.contentUrl).toMatch(/^https:\/\/avaterra\.pro\/uploads\/clips\/[\w.-]+\.mp4$/);
      expect(ld.thumbnailUrl).toHaveLength(2);
      expect(ld.thumbnailUrl[0]).toBe(`${BASE}${clipPosterSrc(c, 'jpg')}`);
      expect(ld.thumbnailUrl[1]).toBe(`${BASE}${clipPosterSrc(c, 'webp')}`);
      for (const u of ld.thumbnailUrl) {
        expect(u).toMatch(/^https:\/\//);
      }
      expect(ld.uploadDate).toBe(c.uploadDate);
      expect(ld.publisher['@id']).toBe(`${BASE}/#organization`);
    }
  });

  it('не оставляет двойной слэш при базе со слэшем на конце', () => {
    const ld = buildVideoObject(VIDEO_CLIPS[0], `${BASE}/`);
    expect(ld.contentUrl).not.toContain('//uploads');
  });
});

describe('тексты роликов', () => {
  it('проходят scanPublishBlockers', () => {
    for (const c of VIDEO_CLIPS) {
      const issues = scanPublishBlockers(`${c.title}. ${c.description}`);
      expect(issues, c.slug).toEqual([]);
    }
  });

  it('в title нет частицы «не» (правило Татьяны)', () => {
    for (const c of VIDEO_CLIPS) {
      expect(titleProblems(c.title), c.slug).toEqual([]);
    }
  });

  it('без цен и медицинских обещаний', () => {
    for (const c of VIDEO_CLIPS) {
      expect(`${c.title} ${c.description}`, c.slug).not.toMatch(PRICE_OR_PROMISE);
    }
  });
});
