/**
 * Обещание бренда по решению владельца 25.10.2026: школа учит «присматриваться к
 * телесному и эмоциональному напряжению через обратную связь мышц», а не «находить
 * причину проблемы за 30 секунд». Тест — не детектор лжи и не диагностика.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  'components/sections/Hero.tsx',
  'app/layout.tsx',
  'app/manifest.ts',
  'components/JsonLdCourse.tsx',
  'app/llms-full.txt/route.ts',
  'lib/content/course-mt-landing.ts',
  'lib/content/kb-seo-articles.ts',
];

const RISKY =
  /наход\p{L}* (скрыт\p{L}* )?(корень|причин)|найти причину|причин\p{L}* проблем\p{L}* (примерно )?за 30 секунд|стресс или ложь|Диагностика за/iu;

describe('brand-promise', () => {
  it('в главных текстах сайта нет «найти причину проблемы» и «стресс или ложь»', () => {
    for (const file of FILES) {
      const text = readFileSync(file, 'utf8');
      const hit = text.match(RISKY);
      expect(hit?.[0], file).toBeUndefined();
    }
    // Позитивный контроль регулярки на кириллице.
    for (const s of [
      'Узнайте, как найти причину проблемы за 30 секунд.',
      'Находите корень проблемы (здоровье, деньги, отношения)',
      'находить скрытые причины проблем',
      'Мышца ослабевает в ответ на стресс или ложь',
      'Диагностика за 5–15 минут',
    ]) {
      expect(s).toMatch(RISKY);
    }
  });
});
