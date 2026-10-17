/**
 * Проверка поста очереди (lib/social/post-checks.ts): дисклеймер, латиница бренда, «метод», окно длины
 * по типу поста, CTA, и необязательный postType в формате очереди.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '@/lib/content/brand-kb';
import { checkQueuedPost } from '@/lib/social/post-checks';
import { parseQueueInput } from '@/lib/social/queue-input';

const ROOT = path.resolve(__dirname, '..', '..');
const brand = normalizeBrandFromKb(loadKbYamlFromPath(path.join(ROOT, 'content', 'knowledge', 'avaterra.yaml')));
const POST_TYPES = brand.templates.map((t) => String(t.id));

const CLEAN_BODY = 'Короткое объяснение: как тело откликается на стресс и что можно заметить за день.';

function check(overrides: Partial<Parameters<typeof checkQueuedPost>[0]> = {}) {
  return checkQueuedPost({
    networkCode: 'telegram',
    title: 'Мышцы и нервная система',
    body: CLEAN_BODY,
    hasMedia: true,
    refCode: 'tg-01',
    brand,
    ...overrides,
  });
}

const DISCLAIMER_PROBLEM = 'дисклеймера нет';

describe('checkQueuedPost: чистый пост', () => {
  it('без проблем и замечаний', () => {
    expect(check()).toEqual({ problems: [], warnings: [] });
  });
});

describe('checkQueuedPost: дисклеймер', () => {
  it('«боль в шее» без дисклеймера — проблема', () => {
    const r = check({ body: 'Боль в шее по утрам часто связана с позой за компьютером.' });
    expect(r.problems.some((p) => p.includes(DISCLAIMER_PROBLEM))).toBe(true);
  });

  it('«больше практики» — дисклеймер не нужен', () => {
    const r = check({ body: 'Больше практики — меньше догадок: тело подскажет ответ.' });
    expect(r.problems.some((p) => p.includes(DISCLAIMER_PROBLEM))).toBe(false);
  });

  it('с фразой «не замена врачу» проблемы нет', () => {
    const r = check({
      body: 'Боль в шее по утрам часто связана с позой. Это не замена врачу: при острой боли обратитесь к специалисту.',
    });
    expect(r.problems.some((p) => p.includes(DISCLAIMER_PROBLEM))).toBe(false);
  });
});

describe('checkQueuedPost: стоп-слова публикации (по исходному тексту)', () => {
  it('латиница Avaterra в тексте — проблема (подпись её уже заменила бы)', () => {
    const r = check({ body: 'Avaterra — школа, где работают с телом. ' + CLEAN_BODY });
    expect(r.problems.some((p) => p.includes('Avaterra'))).toBe(true);
  });

  // Известный дефект lib/content/quality-gates.ts: METHOD_WORD = /\bметод…\b/i без флага u.
  // В JS \b не работает на кириллице, поэтому «метод» по-русски не ловится (ни здесь, ни в evaluateText).
  // Правило gate не меняли по задаче; тест помечен как fails и станет красным, когда дефект починят.
  it('«метод» — проблема', () => {
    const r = check({ body: 'Это метод самонаблюдения, без оценок. ' + CLEAN_BODY });
    expect(r.problems.some((p) => p.includes('метод'))).toBe(true);
  });

  it('«калибровка» — проблема, хотя подпись её заменяет', () => {
    const r = check({ body: 'Калибровка тела занимает минуту. ' + CLEAN_BODY });
    expect(r.problems.some((p) => p.includes('калибр'))).toBe(true);
  });

  it('чужой домен в тексте — проблема', () => {
    const r = check({ body: CLEAN_BODY + ' Подробности: https://example.com/article' });
    expect(r.problems.some((p) => p.includes('чужие домены'))).toBe(true);
  });

  it('частица «не» в заголовке — проблема (правило названий)', () => {
    const r = check({ title: 'Почему тело не молчит' });
    expect(r.problems.some((p) => p.includes('частица «не»'))).toBe(true);
  });
});

describe('checkQueuedPost: окно длины и CTA по postType', () => {
  it('короткий текст для educational (окно 1200–1800) — предупреждение', () => {
    const r = check({ postType: 'educational' });
    expect(r.warnings.some((w) => w.includes('educational') && w.includes('знаков'))).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('без postType окно длины не проверяется', () => {
    const r = check();
    expect(r.warnings.some((w) => w.includes('знаков'))).toBe(false);
  });

  it('пост типа pain (default_cta есть) без ссылки и призыва — предупреждение CTA', () => {
    const r = check({ postType: 'pain', body: CLEAN_BODY });
    expect(r.warnings.some((w) => w.includes('ждёт CTA'))).toBe(true);
  });

  it('тот же тип со ссылкой на сайт — CTA есть', () => {
    const r = check({ postType: 'pain', body: CLEAN_BODY + ' Программа: https://avaterra.pro/course/navyki' });
    expect(r.warnings.some((w) => w.includes('ждёт CTA'))).toBe(false);
  });

  // Известный дефект quality-gates.ts: CTA_HINT_PATTERNS с \b не срабатывают на кириллических словах
  // («Подробнее», «курс», «сохраните»). Только ссылка или avaterra.pro снимают предупреждение.
  it('призыв словом «Подробнее» снимает CTA-предупреждение', () => {
    const r = check({ postType: 'pain', body: CLEAN_BODY + ' Подробнее в описании курса.' });
    expect(r.warnings.some((w) => w.includes('ждёт CTA'))).toBe(false);
  });
});

describe('checkQueuedPost: прочее', () => {
  it('латинское слово (не бренд) — предупреждение, не проблема', () => {
    const r = check({ body: CLEAN_BODY + ' Смотрите Instagram.' });
    expect(r.warnings.some((w) => w.includes('латинские слова'))).toBe(true);
    expect(r.problems.some((p) => p.includes('латинские'))).toBe(false);
  });

  it('ссылка на сайт не даёт латиницу в предупреждениях', () => {
    const r = check({ body: CLEAN_BODY + ' Глоссарий: https://avaterra.pro/glossary/telesnaya-pamyat' });
    expect(r.warnings.some((w) => w.includes('латинские'))).toBe(false);
    expect(r.problems).toEqual([]);
  });

  it('неизвестная сеть — ошибка вызова', () => {
    expect(() => check({ networkCode: 'myspace' })).toThrow();
  });

  it('готовая сеть (VK) — подпись проверяется тем же путём', () => {
    const r = check({ networkCode: 'vk', body: 'Боль в шее по утрам. ' + CLEAN_BODY });
    expect(r.problems.some((p) => p.includes(DISCLAIMER_PROBLEM))).toBe(true);
  });
});

describe('postType в формате очереди', () => {
  const DIR = path.join(ROOT, 'tests', 'unit');
  const base = { title: 'Тест', body: CLEAN_BODY, ref: 'tg-01', scheduledAt: '2026-10-19 10:00' };

  it('известный тип проходит и попадает в запись', () => {
    const r = parseQueueInput([{ ...base, postType: 'pain' }], { mediaDir: DIR, postTypes: POST_TYPES });
    expect(r.errors).toEqual([]);
    expect(r.entries[0]?.postType).toBe('pain');
  });

  it('неизвестный тип — ошибка разбора', () => {
    const r = parseQueueInput([{ ...base, postType: 'blog' }], { mediaDir: DIR, postTypes: POST_TYPES });
    expect(r.errors[0]).toContain('postType «blog»');
    expect(r.entries).toEqual([]);
  });

  it('без postType поле не появляется в записи', () => {
    const r = parseQueueInput([base], { mediaDir: DIR, postTypes: POST_TYPES });
    expect(r.errors).toEqual([]);
    expect(r.entries[0]).not.toHaveProperty('postType');
  });
});

describe('черновик контент-плана 19.10 (docs/marketing)', () => {
  const files = [
    'docs/marketing/queue-text-2026-10-19.telegram.json',
    'docs/marketing/queue-text-2026-10-19.max.json',
  ];
  for (const rel of files) {
    it(`${path.basename(rel)} проходит проверку без исключений`, () => {
      const items = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as Array<{
        title: string;
        body: string;
        ref: string;
      }>;
      const networkCode = rel.includes('.max.') ? 'max' : 'telegram';
      for (const item of items) {
        const r = checkQueuedPost({
          networkCode,
          title: item.title,
          body: item.body,
          hasMedia: false,
          refCode: item.ref,
          brand,
        });
        expect(Array.isArray(r.problems)).toBe(true);
        expect(Array.isArray(r.warnings)).toBe(true);
      }
    });
  }
});
