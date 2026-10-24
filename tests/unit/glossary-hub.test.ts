/**
 * Хаб /glossary: темы покрывают словарь ровно по одному разу, вводный текст — по объёму
 * и правилам школы. Новый термин в lib/content/glossary.ts без темы в glossary-groups.ts
 * провалит первый тест (иначе он молча не попадёт на хаб).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { GLOSSARY_GROUPS, GLOSSARY_HUB_INTRO } from '@/lib/content/glossary-groups';
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

function linkTargets(md: string): string[] {
  return Array.from(md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), (m) => m[1]);
}

describe('хаб словаря: темы', () => {
  it('каждый термин словаря стоит ровно в одной теме', () => {
    const count = new Map<string, number>();
    for (const g of GLOSSARY_GROUPS) for (const s of g.slugs) count.set(s, (count.get(s) ?? 0) + 1);
    for (const t of GLOSSARY_TERMS) {
      expect(count.get(t.slug) ?? 0, t.slug).toBe(1);
    }
  });

  it('в темах нет несуществующих slug и повторов внутри темы', () => {
    const known = new Set(GLOSSARY_TERMS.map((t) => t.slug));
    for (const g of GLOSSARY_GROUPS) {
      for (const s of g.slugs) expect(known.has(s), `${g.title}: ${s}`).toBe(true);
      expect(new Set(g.slugs).size, `${g.title}: повтор slug`).toBe(g.slugs.length);
    }
  });

  it('тем от 4 до 6, у каждой есть термины, заголовки уникальны', () => {
    expect(GLOSSARY_GROUPS.length).toBeGreaterThanOrEqual(4);
    expect(GLOSSARY_GROUPS.length).toBeLessThanOrEqual(6);
    for (const g of GLOSSARY_GROUPS) expect(g.slugs.length, g.title).toBeGreaterThan(0);
    const titles = GLOSSARY_GROUPS.map((g) => g.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('заголовки тем без частицы «не» и без блокирующих слов', () => {
    for (const g of GLOSSARY_GROUPS) {
      expect(g.title, g.title).not.toMatch(NOT_PARTICLE);
      expect(scanPublishBlockers(g.title), g.title).toEqual([]);
    }
  });
});

describe('хаб словаря: вводный текст', () => {
  const text = plainText(GLOSSARY_HUB_INTRO);

  it('120–200 слов', () => {
    const words = text.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(120);
    expect(words).toBeLessThanOrEqual(200);
  });

  it('проходит scanPublishBlockers: нет «метод», «калибровки», чужих ссылок', () => {
    expect(scanPublishBlockers(GLOSSARY_HUB_INTRO)).toEqual([]);
  });

  it('не содержит prohibited_phrases из avaterra.yaml', () => {
    const phrases = prohibitedPhrases();
    expect(phrases.length).toBeGreaterThan(5);
    for (const p of phrases) {
      expect(new RegExp(p, 'i').test(text), `«${p}»`).toBe(false);
    }
  });

  it('ссылки ведут на существующие термины и существующий курс', () => {
    const slugs = new Set(GLOSSARY_TERMS.map((t) => t.slug));
    const links = linkTargets(GLOSSARY_HUB_INTRO);
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const href of links) {
      if (href.startsWith('/glossary/')) {
        expect(slugs.has(href.slice('/glossary/'.length)), href).toBe(true);
      } else if (href.startsWith('/course/')) {
        const slug = href.slice('/course/'.length);
        expect(existsSync(join(process.cwd(), 'app/course', slug, 'page.tsx')), href).toBe(true);
      } else {
        throw new Error(`неожиданная ссылка во вводном тексте: ${href}`);
      }
    }
  });

  it('новичку предложены базовые термины и курс; есть оговорка про врача и диагнозы', () => {
    const links = linkTargets(GLOSSARY_HUB_INTRO);
    for (const slug of ['myshechnoe-testirovanie', 'samotestirovanie', 'otvet-tela', 'emotsionalnyy-zaryad']) {
      expect(links, slug).toContain(`/glossary/${slug}`);
    }
    expect(links).toContain('/course/navyki-myshechnogo-testirovaniya');
    expect(text).toMatch(/не лечит/);
    expect(text).toMatch(/не ставит диагнозов/);
    expect(text).toMatch(/научного подтверждения/i);
  });
});
