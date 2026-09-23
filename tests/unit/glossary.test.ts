/** Глоссарий: инварианты контента и правила школы (без БД). */
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS, getGlossarySorted, getGlossaryTerm } from '@/lib/content/glossary';
import { KB_SEO_ARTICLES } from '@/lib/content/kb-seo-articles';

describe('glossary', () => {
  it('слаги уникальны и URL-безопасны', () => {
    const slugs = GLOSSARY_TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it('правила контента школы: без «калибровки», цен и медицинских обещаний', () => {
    const all = GLOSSARY_TERMS.map((t) => `${t.term} ${t.short} ${t.body}`).join('\n');
    expect(all).not.toMatch(/калибровк/i);
    expect(all).not.toMatch(/\d{2} ?000 ?₽/);
    expect(all).not.toMatch(/вылечи|гарантируем результат/i);
  });

  it('short — короткое определение для сниппета (40–260 символов)', () => {
    for (const t of GLOSSARY_TERMS) {
      expect(t.short.length, t.slug).toBeGreaterThanOrEqual(40);
      expect(t.short.length, t.slug).toBeLessThanOrEqual(260);
    }
  });

  it('ссылки на KB-статьи ведут на существующие слаги', () => {
    const kb = new Set(KB_SEO_ARTICLES.map((a) => a.slug));
    // Статьи не из KB (ранние, из БД) начинаются с «vy-»/«v-» — их существование проверяет рендер.
    for (const t of GLOSSARY_TERMS) {
      for (const a of t.articles ?? []) {
        if (!/^(vy-|v-)/.test(a)) expect(kb.has(a), `${t.slug} → ${a}`).toBe(true);
      }
    }
  });

  it('сортировка по русскому алфавиту и поиск по слагу', () => {
    const sorted = getGlossarySorted().map((t) => t.term);
    expect(sorted[0].localeCompare(sorted[sorted.length - 1], 'ru')).toBeLessThan(0);
    expect(getGlossaryTerm('lobnyy-obhvat')?.term).toBe('Лобный обхват');
    expect(getGlossaryTerm('nope')).toBeUndefined();
  });
});
