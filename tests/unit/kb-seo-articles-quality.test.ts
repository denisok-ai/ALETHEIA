/**
 * Статьи под поисковые запросы «мышечный тест самостоятельно» и «жизнь на автопилоте»:
 * проходят publish-блокеры, не содержат запрещённых формулировок из базы знаний,
 * ведут на нужные внутренние страницы, заголовки без частицы «не».
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KB_SEO_ARTICLES, type KbSeoArticle } from '@/lib/content/kb-seo-articles';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '@/lib/content/brand-kb';
import { scanPublishBlockers } from '@/lib/content/quality-gates';

const kb = loadKbYamlFromPath(path.resolve(process.cwd(), 'content/knowledge/avaterra.yaml'));
const brand = normalizeBrandFromKb(kb);

const article = (slug: string): KbSeoArticle => {
  const a = KB_SEO_ARTICLES.find((x) => x.slug === slug);
  if (!a) throw new Error(`нет статьи ${slug}`);
  return a;
};

const ARTICLES: Array<{ slug: string; links: string[] }> = [
  {
    slug: 'myshechnoe-testirovanie-na-sebe',
    links: [
      '/glossary/myshechnoe-testirovanie',
      '/blog/myshechnoe-testirovanie-pravda-ili-samovnushenie',
      '/course/navyki-myshechnogo-testirovaniya',
    ],
  },
  {
    slug: 'zhizn-na-avtopilote',
    links: ['/glossary/avtopilot', '/course/probuzhdenie', '/glossary/telesnaya-pamyat'],
  },
];

const fullText = (a: KbSeoArticle) => [a.title, a.h1, a.description, a.markdown].join('\n');

describe.each(ARTICLES)('статья $slug', ({ slug, links }) => {
  const a = article(slug);

  it('проходит scanPublishBlockers без замечаний', () => {
    expect(scanPublishBlockers(fullText(a))).toEqual([]);
  });

  it('не содержит prohibited_phrases из avaterra.yaml', () => {
    const text = fullText(a);
    for (const phrase of brand.prohibitedPhrases) {
      expect(new RegExp(phrase, 'i').test(text), `фраза «${phrase}»`).toBe(false);
    }
  });

  it('содержит нужные внутренние ссылки', () => {
    for (const link of links) expect(a.markdown, link).toContain(`](${link})`);
  });

  it('title без отдельного слова «не» (бренд добавляет layout)', () => {
    const words = a.title.toLowerCase().split(/[^а-яё]+/u);
    expect(words).not.toContain('не');
    expect(a.title).not.toContain('АВАТЕРРА');
  });

  it('description 70–160 знаков', () => {
    expect(a.description.length).toBeGreaterThanOrEqual(70);
    expect(a.description.length).toBeLessThanOrEqual(160);
  });

  it('школа в тексте кириллицей, без «калибр…», без «метод…», без цен', () => {
    const text = fullText(a);
    expect(text).not.toMatch(/avaterra/i);
    expect(text).not.toMatch(/калибр/i);
    // Позитивный контроль: регулярка ловит кириллицу (\b в JS — только ASCII).
    expect('Наш метод и методика').toMatch(/(?<!\p{L})метод/iu);
    expect(text).not.toMatch(/(?<!\p{L})метод/iu);
    expect(text).not.toMatch(/₽|\d\s?000/);
  });

  it('содержит дисклеймер «не замена врачу»', () => {
    expect(a.markdown).toMatch(/не замена врачу/);
  });
});

describe('форма ссылок на курс и статьи', () => {
  it('статья про самотестирование называет курс самостоятельным и без кураторов', () => {
    const text = article('myshechnoe-testirovanie-na-sebe').markdown;
    expect(text).toMatch(/самостоятельн/i);
    expect(text).toMatch(/6 модулей/);
    expect(text).toMatch(/3 месяц/);
  });
});
