/**
 * SEO-переопределения витрин /services/<slug>: витрина практикума отвечает на
 * «оплата и условия доступа» и не конкурирует с посадочной курса (25.10.2026).
 */
import { describe, expect, it } from 'vitest';
import { SERVICE_SEO_OVERRIDES, serviceSeoOverride } from '@/lib/seo/service-seo';

const NE = /(?<!\p{L})не(?!\p{L})/iu;

describe('service-seo', () => {
  it('витрина практикума — про оплату и ведёт на программу курса', () => {
    const seo = serviceSeoOverride('telo-znaet-vse');
    expect(seo?.title).toMatch(/оплат/i);
    expect(seo?.h1).toMatch(/оплата и условия доступа/i);
    expect(seo?.programLink).toEqual({
      href: '/course/navyki-myshechnogo-testirovaniya',
      label: 'Программа практикума',
    });
  });

  it('у остальных тарифов переопределения нет', () => {
    expect(serviceSeoOverride('kod-tela-start')).toBeUndefined();
  });

  it('длины и правила текстов', () => {
    for (const [slug, seo] of Object.entries(SERVICE_SEO_OVERRIDES)) {
      expect(seo.title.length, slug).toBeLessThanOrEqual(60);
      expect(seo.description.length, slug).toBeGreaterThanOrEqual(140);
      expect(seo.description.length, slug).toBeLessThanOrEqual(160);
      for (const text of [seo.title, seo.h1]) expect(text, slug).not.toMatch(NE);
      expect(`${seo.title} ${seo.description} ${seo.h1}`, slug).not.toMatch(/(?<!\p{L})метод|калибр|АВАТЕРРА|avaterra/iu);
    }
    // Позитивный контроль регулярки «не» на кириллице.
    expect('Курс не для всех').toMatch(NE);
  });
});
