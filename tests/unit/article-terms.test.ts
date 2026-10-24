/** Блок «Термины по теме» и ссылка на курс под статьёй блога: выбор терминов и запасная ссылка. */
import { describe, expect, it } from 'vitest';
import { articleTerms } from '@/lib/content/article-terms';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { topicsOf } from '@/lib/content/blog-related';
import { COURSE_FALLBACK_LINK, courseLinksFor } from '@/lib/content/blog-course-links';
import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { KB_SEO_ARTICLES } from '@/lib/content/kb-seo-articles';
import { scanPublishBlockers } from '@/lib/content/quality-gates';

const ENTITY_SLUGS = ['kurs-telo-znaet-vse', 'kurs-probuzhdenie', 'tatyana-streltsova'];
const COURSE_PATH = '/course/navyki-myshechnogo-testirovaniya';
const STANDALONE_NE = /(?<![\p{L}])не(?![\p{L}])/iu;

/** Слаги всех статей, которые видит посетитель из статических источников. */
const STATIC_ARTICLE_SLUGS = [...blogPostsMeta.map((p) => p.slug), ...KB_SEO_ARTICLES.map((a) => a.slug)];

describe('articleTerms: термины, связанные со статьёй в глоссарии', () => {
  it('берёт термины, у которых статья указана в articles, и ограничивает четырьмя', () => {
    // У этой статьи в глоссарии больше четырёх связанных терминов — выводим первые четыре по порядку глоссария.
    const linked = GLOSSARY_TERMS.filter((t) => t.articles?.includes('chto-takoe-myshechnoe-testirovanie'));
    expect(linked.length).toBeGreaterThan(4);
    const out = articleTerms('chto-takoe-myshechnoe-testirovanie');
    expect(out.map((t) => t.slug)).toEqual(linked.slice(0, 4).map((t) => t.slug));
  });

  it('курсы и автор не попадают в блок, даже если статья указана у них', () => {
    const out = articleTerms('myshechnoe-testirovanie-obuchenie');
    for (const slug of ENTITY_SLUGS) {
      expect(out.map((t) => t.slug)).not.toContain(slug);
    }
  });

  it('термин, уже показанный в теле статьи (текстом или ссылкой), не повторяется', () => {
    const body = 'Разбираем [мышечное тестирование](/glossary/myshechnoe-testirovanie) и кольцо в кольце.';
    const out = articleTerms('chto-takoe-myshechnoe-testirovanie', body);
    expect(out.map((t) => t.slug)).not.toContain('myshechnoe-testirovanie');
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('articleTerms: запасной выбор, если связанных терминов меньше двух', () => {
  it('без связей и без общего кластера берёт ядро словаря школы', () => {
    const out = articleTerms('zapisi-bez-temy-xyz');
    expect(out.map((t) => t.slug)).toEqual(['myshechnoe-testirovanie', 'kineziolog']);
  });

  it('без прямых связей добирает термины того же кластера, что и статья', () => {
    const slug = 'kakoe-to-myshechnoe-zapis';
    expect(topicsOf(slug).has('method')).toBe(true);
    const out = articleTerms(slug);
    expect(out).toHaveLength(2);
    for (const t of out) {
      expect(topicsOf(t.slug).has('method'), t.slug).toBe(true);
    }
  });
});

describe('articleTerms: инварианты для всех статей блога', () => {
  it.each(STATIC_ARTICLE_SLUGS.map((s) => [s]))('статья %s: от двух до четырёх терминов без повторов', (slug) => {
    const out = articleTerms(slug);
    expect(out.length, slug).toBeGreaterThanOrEqual(2);
    expect(out.length, slug).toBeLessThanOrEqual(4);
    expect(new Set(out.map((t) => t.slug)).size, slug).toBe(out.length);
    for (const t of out) {
      expect(ENTITY_SLUGS, slug).not.toContain(t.slug);
    }
  });
});

describe('courseLinksFor: ссылка на курс у каждой статьи', () => {
  it('статья со своими якорями получает их без изменений', () => {
    expect(courseLinksFor('telo-znaet-otvet')).toEqual([
      { href: `${COURSE_PATH}#module-2`, label: 'Фрагмент про эмоции и «карту» тела в программе курса' },
    ]);
  });

  it('статья без своих якорей получает запасную ссылку на курс', () => {
    expect(courseLinksFor('zapisi-bez-temy-xyz')).toEqual([COURSE_FALLBACK_LINK]);
    expect(COURSE_FALLBACK_LINK.href).toBe(COURSE_PATH);
    expect(COURSE_FALLBACK_LINK.label).toBe('Программа практикума «Тело знает всё»');
  });

  it('каждая статья из статических источников получает хотя бы одну ссылку на курс', () => {
    for (const slug of STATIC_ARTICLE_SLUGS) {
      const links = courseLinksFor(slug);
      expect(links.length, slug).toBeGreaterThan(0);
      for (const l of links) {
        expect(l.href.startsWith('/course/'), slug).toBe(true);
      }
    }
  });

  it('новые тексты блока проходят правила школы', () => {
    for (const text of [
      'Термины по теме',
      'Связь с программой курса',
      COURSE_FALLBACK_LINK.label,
      'Частые вопросы о практикуме и подходе',
    ]) {
      expect(scanPublishBlockers(text), text).toEqual([]);
      expect(STANDALONE_NE.test(text), text).toBe(false);
    }
  });
});
