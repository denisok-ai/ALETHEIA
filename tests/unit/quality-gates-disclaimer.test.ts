/**
 * Триггеры дисклеймера (disclaimer.triggers в avaterra.yaml): совпадение по слову и его формам,
 * а не по подстроке. «боль» → боль/боли/болью/болей; «больше», «большой», «большинство» — нет.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '@/lib/content/brand-kb';
import { evaluateText, matchesDisclaimerTrigger } from '@/lib/content/quality-gates';

const KB_PATH = path.resolve(__dirname, '..', '..', 'content', 'knowledge', 'avaterra.yaml');
const brand = normalizeBrandFromKb(loadKbYamlFromPath(KB_PATH));

/** Примеры «да / нет» на каждый триггер из yaml. Ключ — триггер как записан в yaml. */
const CASES: Record<string, { yes: string[]; no: string[] }> = {
  боль: {
    yes: ['Боль в спине', 'боли в шее по утрам', 'Болью отдаётся в плечо', 'болей стало меньше'],
    no: ['Больше практики', 'большой опыт', 'Большинство людей'],
  },
  болит: {
    yes: ['Что делать, если болит голова', 'когда болит спина'],
    no: ['болото рядом', 'болтать о тексте'],
  },
  травма: {
    yes: ['Травма детства', 'после травмы', 'Травмой это не назвать'],
    no: ['травяной чай', 'травяные сборы'],
  },
  тревог: {
    yes: ['тревога перед экзаменом', 'Тревоги становится меньше', 'с тревогой на работе'],
    no: ['треугольник', 'трень-брень'],
  },
  паник: {
    yes: ['Паника в метро', 'паники больше нет', 'Паникой это не объяснить'],
    no: ['панорама', 'панель управления'],
  },
  депресс: {
    yes: ['Депрессия без причины', 'при депрессии', 'депрессией'],
    no: ['депо', 'депутат'],
  },
  психосомат: {
    yes: ['Психосоматика: что это', 'психосоматики в тексте нет'],
    no: ['психология тела', 'психолог на приёме'],
  },
  симптом: {
    yes: ['Симптомы стресса', 'список симптомов', 'симптомах тела'],
    no: ['симпатия к коллеге', 'симфония'],
  },
  болезн: {
    yes: ['Болезнь или стресс', 'болезни суставов', 'болезней много'],
    no: ['болонка', 'болтовня'],
  },
  температур: {
    yes: ['Температура 37', 'температуры тела', 'при температуре'],
    no: ['темперамент', 'темпераментный человек'],
  },
};

describe('matchesDisclaimerTrigger: одиночные триггеры из yaml', () => {
  it('в yaml нет триггеров без примеров «да/нет»', () => {
    const triggers = (brand.disclaimer.triggers as string[] | undefined) ?? [];
    expect(triggers.length).toBeGreaterThan(0);
    for (const t of triggers) expect(CASES[t], `нет примеров для «${t}»`).toBeDefined();
  });

  for (const [trigger, cases] of Object.entries(CASES)) {
    it(`«${trigger}»: формы срабатывают`, () => {
      for (const text of cases.yes) expect(matchesDisclaimerTrigger(text, trigger), text).toBe(true);
    });
    it(`«${trigger}»: посторонние слова не срабатывают`, () => {
      for (const text of cases.no) expect(matchesDisclaimerTrigger(text, trigger), text).toBe(false);
    });
  }

  it('«боль» не срабатывает на «больше», «большой», «большинство»', () => {
    expect(matchesDisclaimerTrigger('Больше 22 лет практики', 'боль')).toBe(false);
    expect(matchesDisclaimerTrigger('большой выбор тем', 'боль')).toBe(false);
    expect(matchesDisclaimerTrigger('большинство читателей', 'боль')).toBe(false);
  });
});

describe('matchesDisclaimerTrigger: многословный триггер', () => {
  it('все слова, кроме последнего, точно; последнее — основа с окончанием', () => {
    expect(matchesDisclaimerTrigger('острая боль утром', 'острая боль')).toBe(true);
    expect(matchesDisclaimerTrigger('острая боли не было', 'острая боль')).toBe(true);
    expect(matchesDisclaimerTrigger('острая больше не мешает', 'острая боль')).toBe(false);
    expect(matchesDisclaimerTrigger('обычная боль', 'острая боль')).toBe(false);
  });
});

describe('evaluateText: дисклеймер по теме поста', () => {
  const text = 'Текст поста про тело, стресс и подход школы. Без обещаний и диагнозов, с вопросом читателю в конце.';
  const missing = (topic: string) =>
    evaluateText({ text, topic, postType: 'educational', brand }).issues.some((i) => i.code === 'missing_disclaimer');

  it('тема со словом «боли» требует дисклеймер', () => {
    expect(missing('Боли в шее при работе за компьютером')).toBe(true);
  });

  it('тема со словом «больше» дисклеймер не требует', () => {
    expect(missing('Больше практики, меньше теории')).toBe(false);
  });
});
