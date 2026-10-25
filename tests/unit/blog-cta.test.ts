/**
 * Призывы внизу статей (BLOG_CTA) согласованы с текстами статей и решениями владельца
 * от 25.10.2026: тест «присматривается к напряжению», а не находит причину; без
 * заявлений о научной обоснованности; без обещаний поддержки, которой в практикуме нет.
 */
import { describe, expect, it } from 'vitest';
import { BLOG_CTA } from '@/lib/content/blog-course-links';

const NE = /(?<!\p{L})не(?!\p{L})/iu;
const RISKY = /наход\p{L}* (корень|причин)|до причины|убрать её|основан\p{L}* на физиологии|с поддержкой/iu;

describe('blog-cta', () => {
  it('заголовки без частицы «не», тексты без рискованных обещаний', () => {
    for (const [slug, cta] of Object.entries(BLOG_CTA)) {
      if (!cta) continue;
      expect(cta.heading, slug).not.toMatch(NE);
      expect(`${cta.heading} ${cta.text}`, slug).not.toMatch(RISKY);
    }
    // Позитивный контроль регулярок на кириллице.
    expect('Дойти до причины и убрать её').toMatch(RISKY);
    expect('научитесь находить корень проблемы').toMatch(RISKY);
    expect('Тело не врёт').toMatch(NE);
  });
});
