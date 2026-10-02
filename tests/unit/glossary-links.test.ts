/**
 * Подбор терминов глоссария по тексту статьи: падежи находятся, похожие
 * по корню глаголы — нет, курсы/автор не предлагаются.
 */
import { describe, expect, it } from 'vitest';
import { findGlossaryTerms } from '@/lib/content/glossary-links';

const slugs = (t: string, limit?: number) => findGlossaryTerms(t, limit).map((x) => x.slug);

describe('glossary-links', () => {
  it('находит термины в косвенных падежах, в порядке упоминания', () => {
    expect(slugs('Снять эмоционального заряда не удалось, пока не нашли триггеры и установки.')).toEqual([
      'emotsionalnyy-zaryad',
      'trigger',
      'ustanovka',
    ]);
  });

  it('глагол с тем же корнем — не термин', () => {
    expect(slugs('Нужно установить приложение и регулярно заземлять провод.')).not.toContain('ustanovka');
  });

  it('синонимы ведут на свой термин', () => {
    expect(slugs('Пальцевой кольцевой тест удобен без партнёра.')).toContain('kolco-v-kolce');
  });

  it('курсы и автор не предлагаются; лимит соблюдается', () => {
    const text = 'Курс «Пробуждение» и Татьяна Стрельцова. Стресс-реакция, психосоматика, подсознание, регресс, триггер, установка, телесная память.';
    const s = slugs(text, 4);
    expect(s).toHaveLength(4);
    expect(s).not.toContain('kurs-probuzhdenie');
    expect(s).not.toContain('tatyana-streltsova');
  });

  it('если в тексте уже есть ссылка на термин — не дублируем', () => {
    expect(slugs('Подробнее про [триггер](/glossary/trigger).')).not.toContain('trigger');
  });
});

describe('glossary-links: составные синонимы', () => {
  it('«телесный тест» без «да/нет» не считается термином «Ответ тела»', () => {
    expect(slugs('Как отличить жизнь от автопилота? Простой телесный тест.')).not.toContain('otvet-tela');
    expect(slugs('Телесный тест «да/нет» показывает отклик.')).toContain('otvet-tela');
  });
});
