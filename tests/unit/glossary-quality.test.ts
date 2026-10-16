/**
 * Глоссарий: все термины проходят quality gate публикации (scanPublishBlockers).
 *
 * Слово «метод» запрещено в текстах школы (checkNoMethodWord): школа говорит «подход»,
 * «работа школы», «практика», «мышечное тестирование». Проверяем весь глоссарий, не только
 * SEO-термины из glossary-seo.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { GLOSSARY_INTRO, GLOSSARY_TERMS } from '@/lib/content/glossary';
import { scanPublishBlockers, type QualityIssue } from '@/lib/content/quality-gates';

type Field = { slug: string; field: string; text: string };

/**
 * Исключения из проверки scanPublishBlockers. Каждое — с причиной.
 * Сейчас пусто: все поля глоссария проходят gate.
 * Заголовок термина «Границы метода» (slug granitsy-metoda) не входит в проверку —
 * это название термина, а не текст школы; меняется отдельным решением владельца.
 */
const QUALITY_EXCEPTIONS: Array<{ slug: string; field: string; code: string; reason: string }> = [];

function fieldsOf(t: (typeof GLOSSARY_TERMS)[number]): Field[] {
  const out: Field[] = [
    { slug: t.slug, field: 'short', text: t.short },
    { slug: t.slug, field: 'body', text: t.body },
  ];
  (t.faq ?? []).forEach((f, i) => {
    out.push({ slug: t.slug, field: `faq[${i}].q`, text: f.q });
    out.push({ slug: t.slug, field: `faq[${i}].a`, text: f.a });
  });
  if (t.seoTitle) out.push({ slug: t.slug, field: 'seoTitle', text: t.seoTitle });
  if (t.seoDescription) out.push({ slug: t.slug, field: 'seoDescription', text: t.seoDescription });
  // synonyms — формулировки поисковых запросов («метод колечек»), а не голос школы: правило не применяем.
  return out;
}

function isExcepted(f: Field, issue: QualityIssue): boolean {
  return QUALITY_EXCEPTIONS.some((e) => e.slug === f.slug && e.field === f.field && e.code === issue.code);
}

describe('глоссарий: quality gate для всех терминов', () => {
  it('short, body, faq и seo-поля проходят scanPublishBlockers (synonyms — запросы, не проверяем)', () => {
    const problems: string[] = [];
    for (const t of GLOSSARY_TERMS) {
      for (const f of fieldsOf(t)) {
        for (const issue of scanPublishBlockers(f.text)) {
          if (isExcepted(f, issue)) continue;
          problems.push(`${f.slug} ${f.field}: [${issue.code}] ${issue.message}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('GLOSSARY_INTRO проходит scanPublishBlockers', () => {
    expect(scanPublishBlockers(GLOSSARY_INTRO)).toEqual([]);
  });

  it('исключения указывают на реально существующие термины и поля', () => {
    for (const e of QUALITY_EXCEPTIONS) {
      expect(GLOSSARY_TERMS.some((t) => t.slug === e.slug), e.slug).toBe(true);
      expect(e.reason.trim(), `${e.slug}: нужна причина`).not.toBe('');
    }
  });
});
