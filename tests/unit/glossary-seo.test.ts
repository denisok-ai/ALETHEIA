/** Глоссарий: SEO-поля (seoTitle/seoDescription/faq) и тексты терминов под запросы GSC. */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { GLOSSARY_TERMS, getGlossaryTerm } from '@/lib/content/glossary';
import { scanPublishBlockers } from '@/lib/content/quality-gates';

/** Фразы из prohibited_phrases content/knowledge/avaterra.yaml (regex, как в checkProhibited). */
function prohibitedPhrases(): string[] {
  const yaml = readFileSync(join(process.cwd(), 'content/knowledge/avaterra.yaml'), 'utf-8');
  const block = yaml.split(/^prohibited_phrases:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  return Array.from(block.matchAll(/^\s*-\s*"(.*)"\s*$/gm), (m) => m[1]);
}

const SEO_TERMS = [
  'avtopilot',
  'telesnaya-pamyat',
  'myshechnoe-testirovanie',
  'kineziolog',
  'trigger',
  'obratnaya-svyaz-tela',
  'resursnoe-sostoyanie',
] as const;

function termText(slug: string): string {
  const t = getGlossaryTerm(slug);
  if (!t) throw new Error(`нет термина ${slug}`);
  return [t.term, t.short, t.seoTitle, t.seoDescription, t.body, ...(t.faq ?? []).flatMap((f) => [f.q, f.a])]
    .filter(Boolean)
    .join('\n');
}

describe('glossary SEO-поля', () => {
  it('seoTitle до бренд-суффикса ≤ 70 знаков; seoDescription 70–160', () => {
    for (const t of GLOSSARY_TERMS) {
      if (t.seoTitle !== undefined) {
        expect(t.seoTitle.length, `${t.slug} title`).toBeLessThanOrEqual(70);
        expect(t.seoTitle, t.slug).not.toMatch(/\|/); // суффикс добавляет layout
      }
      if (t.seoDescription !== undefined) {
        expect(t.seoDescription.length, `${t.slug} description`).toBeGreaterThanOrEqual(70);
        expect(t.seoDescription.length, `${t.slug} description`).toBeLessThanOrEqual(160);
      }
    }
  });

  it('у всех FAQ непустые q/a, 3–5 вопросов', () => {
    for (const t of GLOSSARY_TERMS) {
      if (!t.faq) continue;
      expect(t.faq.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.faq.length, t.slug).toBeLessThanOrEqual(5);
      for (const f of t.faq) {
        expect(f.q.trim(), `${t.slug} q`).not.toBe('');
        expect(f.a.trim(), `${t.slug} a`).not.toBe('');
      }
    }
  });

  it('в seoTitle терминов из SEO_TERMS нет отдельного слова «не» (правило Татьяны)', () => {
    for (const slug of SEO_TERMS) {
      const title = getGlossaryTerm(slug)?.seoTitle;
      expect(title, slug).toBeDefined();
      expect(title!, slug).not.toMatch(/\bне\b/i);
    }
  });
});

describe('тексты терминов под запросы GSC', () => {
  const phrases = prohibitedPhrases();

  it('фразы из avaterra.yaml прочитаны', () => {
    expect(phrases.length).toBeGreaterThan(5);
  });

  it('проходят scanPublishBlockers', () => {
    for (const slug of SEO_TERMS) {
      expect(scanPublishBlockers(termText(slug)), slug).toEqual([]);
    }
  });

  it('не содержат prohibited_phrases из avaterra.yaml', () => {
    for (const slug of SEO_TERMS) {
      const text = termText(slug);
      for (const p of phrases) {
        expect(new RegExp(p, 'i').test(text), `${slug}: «${p}»`).toBe(false);
      }
    }
  });

  it('без «калибровк», цен и слов о кураторах/сертификате у практикума', () => {
    for (const slug of SEO_TERMS) {
      const text = termText(slug);
      expect(text, slug).not.toMatch(/калибровк/i);
      expect(text, slug).not.toMatch(/\d[\d ]*\s?₽|руб\./i);
      expect(text, slug).not.toMatch(/куратор|сертификат|живых сесси/i);
    }
  });
});
