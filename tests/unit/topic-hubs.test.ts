/**
 * Тематические хабы блога /temy/<slug>: вводный текст, список статей и ссылки.
 * Правила — из docs/seo/google-seo-playbook-2026-10-24.md (пункт 7): 300–500 слов введения,
 * 8–12 статей, без «не» в заголовке, без запрещённых фраз школы.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { findTopicHub, hubPosts, TOPIC_HUBS } from '@/lib/content/topic-hubs';
import { scanPublishBlockers } from '@/lib/content/quality-gates';

/** Частица «не» отдельным словом. \b в JS не работает с кириллицей — границы через \p{L}. */
const NOT_PARTICLE = /(?<![\p{L}])не(?![\p{L}])/iu;

/** Фразы из prohibited_phrases content/knowledge/avaterra.yaml (regex, как в checkProhibited). */
function prohibitedPhrases(): string[] {
  const yaml = readFileSync(join(process.cwd(), 'content/knowledge/avaterra.yaml'), 'utf-8');
  const block = yaml.split(/^prohibited_phrases:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  return Array.from(block.matchAll(/^\s*-\s*"(.*)"\s*$/gm), (m) => m[1]);
}

/** Текст без Markdown: ссылка → подпись, жирный убираем. */
function plainText(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
}

/** Цели внутренних ссылок из Markdown: `/blog/x`, `/glossary/y`. */
function linkTargets(md: string): string[] {
  return Array.from(md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), (m) => m[1]);
}

const SCHOOL_DISCLAIMER = 'Школа не лечит и не ставит диагнозов';

describe('хабы блога: состав', () => {
  it('три хаба с уникальными адресами (латиница и дефисы)', () => {
    expect(TOPIC_HUBS.length).toBe(3);
    const slugs = TOPIC_HUBS.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s, s).toMatch(/^[a-z0-9-]+$/);
  });

  it('у каждого хаба есть короткое название для ссылок', () => {
    for (const h of TOPIC_HUBS) expect(h.label.length, h.slug).toBeGreaterThan(0);
  });

  it('дата правки в формате YYYY-MM-DD', () => {
    for (const h of TOPIC_HUBS) expect(h.revised, h.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('findTopicHub: известный адрес находит хаб, чужой — undefined', () => {
    expect(findTopicHub(TOPIC_HUBS[0].slug)?.slug).toBe(TOPIC_HUBS[0].slug);
    expect(findTopicHub('net-takogo')).toBeUndefined();
  });
});

describe('хабы блога: заголовок и описание', () => {
  it('заголовок без частицы «не» (позитивный контроль регулярки)', () => {
    expect('Почему не работает').toMatch(NOT_PARTICLE);
    expect('Тело и стресс: статьи школы Аватэрра').not.toMatch(NOT_PARTICLE);
    for (const h of TOPIC_HUBS) expect(h.title, h.slug).not.toMatch(NOT_PARTICLE);
  });

  it('заголовок и описание проходят scanPublishBlockers', () => {
    for (const h of TOPIC_HUBS) {
      expect(scanPublishBlockers(h.title), h.slug).toEqual([]);
      expect(scanPublishBlockers(h.description), h.slug).toEqual([]);
    }
  });

  it('описание до 160 знаков', () => {
    for (const h of TOPIC_HUBS) expect(h.description.length, h.slug).toBeLessThanOrEqual(160);
  });
});

describe('хабы блога: вводный текст', () => {
  for (const hub of TOPIC_HUBS) {
    const text = plainText(hub.intro);

    it(`${hub.slug}: 300–500 слов`, () => {
      const words = text.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(300);
      expect(words).toBeLessThanOrEqual(500);
    });

    it(`${hub.slug}: проходит scanPublishBlockers (нет «метод», «калибровки», чужих ссылок)`, () => {
      expect(scanPublishBlockers(hub.intro)).toEqual([]);
    });

    it(`${hub.slug}: содержит оговорку школы`, () => {
      expect(text).toContain(SCHOOL_DISCLAIMER);
    });

    it(`${hub.slug}: не содержит prohibited_phrases из avaterra.yaml`, () => {
      const phrases = prohibitedPhrases();
      expect(phrases.length).toBeGreaterThan(5);
      for (const p of phrases) {
        expect(new RegExp(p, 'i').test(text), `«${p}»`).toBe(false);
      }
    });

    it(`${hub.slug}: ссылки на статьи — только из списка хаба, ссылки на словарь — на существующие термины`, () => {
      const slugs = new Set(GLOSSARY_TERMS.map((t) => t.slug));
      for (const target of linkTargets(hub.intro)) {
        if (target.startsWith('/blog/')) {
          expect(hub.postSlugs, target).toContain(target.slice('/blog/'.length));
        } else if (target.startsWith('/glossary/')) {
          expect(slugs.has(target.slice('/glossary/'.length)), target).toBe(true);
        }
      }
    });
  }

  it('позитивный контроль: оговорка школы находится в тексте, а не только в проверке', () => {
    expect(TOPIC_HUBS.some((h) => plainText(h.intro).includes(SCHOOL_DISCLAIMER))).toBe(true);
  });
});

describe('хабы блога: список статей', () => {
  for (const hub of TOPIC_HUBS) {
    it(`${hub.slug}: от 8 до 12 статей без повторов`, () => {
      expect(hub.postSlugs.length).toBeGreaterThanOrEqual(8);
      expect(hub.postSlugs.length).toBeLessThanOrEqual(12);
      expect(new Set(hub.postSlugs).size).toBe(hub.postSlugs.length);
    });
  }

  it('hubPosts: порядок postSlugs, снятые статьи пропускаются', () => {
    const hub = TOPIC_HUBS[0];
    const [first, second, third] = hub.postSlugs;
    const published = [
      { slug: third, title: 't3' },
      { slug: 'chuzhaya-statya', title: 'x' },
      { slug: first, title: 't1' },
      { slug: second, title: 't2' },
    ];
    expect(hubPosts(hub, published).map((p) => p.slug)).toEqual([first, second, third]);
  });

  it('hubPosts: нет опубликованных статей — пустой список, без ошибок', () => {
    expect(hubPosts(TOPIC_HUBS[0], [])).toEqual([]);
  });
});
