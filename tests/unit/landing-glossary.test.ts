/** Блок «Словарь телесных практик» на главной: состав карточек, обрезка определения, тексты блока. */
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS, getGlossaryTerm } from '@/lib/content/glossary';
import {
  LANDING_GLOSSARY_EXCERPT_MAX,
  LANDING_GLOSSARY_SLUGS,
  glossaryExcerpt,
  landingGlossaryCards,
} from '@/lib/content/landing-glossary';
import { scanPublishBlockers } from '@/lib/content/quality-gates';

/** Частица «не» как отдельное слово — в заголовках блока её быть не должно. */
const STANDALONE_NE = /(?<![\p{L}])не(?![\p{L}])/iu;

describe('LANDING_GLOSSARY_SLUGS: состав карточек', () => {
  it('6–8 терминов, без повторов, каждый есть в глоссарии', () => {
    expect(LANDING_GLOSSARY_SLUGS.length).toBeGreaterThanOrEqual(6);
    expect(LANDING_GLOSSARY_SLUGS.length).toBeLessThanOrEqual(8);
    expect(new Set(LANDING_GLOSSARY_SLUGS).size).toBe(LANDING_GLOSSARY_SLUGS.length);
    for (const slug of LANDING_GLOSSARY_SLUGS) {
      expect(getGlossaryTerm(slug), slug).toBeDefined();
    }
  });

  it('содержит термины, которые получают показы в Google (аудит 24.10)', () => {
    for (const slug of ['avtopilot', 'telesnaya-pamyat', 'emotsionalnyy-zaryad', 'myshechnoe-testirovanie']) {
      expect(LANDING_GLOSSARY_SLUGS).toContain(slug);
    }
  });

  it('карточки строятся в порядке слагов и без пропусков', () => {
    const cards = landingGlossaryCards();
    expect(cards.map((c) => c.slug)).toEqual([...LANDING_GLOSSARY_SLUGS]);
    for (const c of cards) {
      expect(c.term).toBe(getGlossaryTerm(c.slug)?.term);
      expect(c.excerpt.length).toBeLessThanOrEqual(LANDING_GLOSSARY_EXCERPT_MAX + 1);
    }
  });

  it('тексты блока проходят правила школы: без «метод», «калибровка», латиницы «AVATERRA»', () => {
    const texts = [
      'Словарь телесных практик',
      'Словарь',
      'Весь словарь',
      'Определение',
      'Короткие определения терминов, которые встречаются в статьях и практикуме школы Аватэрра.',
      ...landingGlossaryCards().flatMap((c) => [c.term, c.excerpt]),
    ];
    for (const text of texts) {
      expect(scanPublishBlockers(text), text).toEqual([]);
    }
  });

  it('заголовки блока не содержат отдельной частицы «не»', () => {
    for (const text of ['Словарь телесных практик', 'Весь словарь', 'Словарь']) {
      expect(STANDALONE_NE.test(text), text).toBe(false);
    }
  });

  it('у каждой карточки есть содержательное определение', () => {
    for (const card of landingGlossaryCards()) {
      expect(card.excerpt.trim().length, card.slug).toBeGreaterThan(20);
    }
  });
});

describe('glossaryExcerpt: обрезка определения', () => {
  it('короткий текст возвращается без изменений, с нормализованными пробелами', () => {
    expect(glossaryExcerpt('  Короткий   текст ')).toBe('Короткий текст');
  });

  it('длинный текст режется по слову и заканчивается многоточием', () => {
    const text = 'Слово один два три четыре пять шесть семь восемь девять десять';
    const out = glossaryExcerpt(text, 30);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
    const base = out.slice(0, -1);
    expect(text.startsWith(base)).toBe(true);
    expect(text[base.length]).toBe(' ');
  });

  it('хвостовая пунктуация перед многоточием убирается', () => {
    expect(glossaryExcerpt('первое слово, второе', 14)).toBe('первое слово…');
  });

  it('одно длинное слово режется жёстко, без пробела', () => {
    expect(glossaryExcerpt('abcdefghijklmnop', 5)).toBe('abcde…');
  });

  it('на главной определение карточки не длиннее лимита с многоточием', () => {
    for (const term of GLOSSARY_TERMS) {
      expect(glossaryExcerpt(term.short).length, term.slug).toBeLessThanOrEqual(LANDING_GLOSSARY_EXCERPT_MAX + 1);
    }
  });
});
