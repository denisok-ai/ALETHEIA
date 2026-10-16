/**
 * Слово «метод» (любая форма, любой регистр) не попадает в публичные тексты школы.
 *
 * Школа говорит «подход», «работа школы», «практика», «мышечное тестирование».
 * Правило — checkNoMethodWord в quality-gates.ts; «методика/методики» не ловятся и разрешены.
 * Тест прогоняет scanPublishBlockers по текстам, которые видит посетитель сайта или бот:
 * статьи блога, FAQ, лендинг практикума, ссылки блога на курс, термины глоссария.
 *
 * Не покрыто тестом (с причиной): app/llms.txt и app/llms-full.txt собираются из БД
 * (getSystemSettings, getPublishedBlogPosts) — в юнит-тестах без БД не собрать, поэтому
 * их текст проверен при замене вручную и должен проверяться в prod-verify / после деплоя.
 */
import { describe, expect, it } from 'vitest';
import { KB_SEO_ARTICLES } from '@/lib/content/kb-seo-articles';
import { LANDING_FAQ_ITEMS, FAQ_SECTION_ITEMS, FAQ_JSON_LD_ITEMS } from '@/lib/landing-faq';
import * as courseMt from '@/lib/content/course-mt-landing';
import * as blogCourseLinks from '@/lib/content/blog-course-links';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { FAQ_CATEGORIES, FAQ_MATCH_ALIASES } from '@/lib/telegram-bot/faq';
import { OBJECTION_REPLY, OBJECTION_LABEL } from '@/lib/telegram-bot/objection';
import { scanPublishBlockers, type QualityIssue } from '@/lib/content/quality-gates';

/**
 * Явные исключения: строки, где слово допустимо. Пусто — исключений нет.
 * Каждое добавление обязано иметь причину в комментарии.
 */
const EXCEPTIONS: Array<{ where: string; reason: string }> = [];

function methodIssues(text: string): QualityIssue[] {
  return scanPublishBlockers(text).filter((i) => i.code === 'method_word');
}

function assertNoMethodWord(label: string, text: string): void {
  if (EXCEPTIONS.some((e) => label.startsWith(e.where))) return;
  expect(methodIssues(text), `«метод» в ${label}`).toEqual([]);
}

/** Все строковые значения модуля (и вложенные) — одной строкой для скана. */
function flatten(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flatten).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(flatten).join('\n');
  return '';
}

describe('слово «метод» не попадает в публичные тексты', () => {
  it.each(KB_SEO_ARTICLES.map((a) => [a.slug]))('статья блога %s: title, h1, description, markdown', (slug) => {
    const a = KB_SEO_ARTICLES.find((x) => x.slug === slug)!;
    assertNoMethodWord(`kb:${slug}`, [a.title, a.h1, a.description, a.markdown].join('\n'));
  });

  it('FAQ лендинга (LANDING_FAQ_ITEMS, FAQ_SECTION_ITEMS, FAQ_JSON_LD_ITEMS)', () => {
    assertNoMethodWord('landing-faq', flatten([LANDING_FAQ_ITEMS, FAQ_SECTION_ITEMS, FAQ_JSON_LD_ITEMS]));
  });

  it('лендинг практикума course-mt-landing (все экспорты)', () => {
    assertNoMethodWord('course-mt-landing', flatten(courseMt));
  });

  it('ссылки блога на курс (blog-course-links)', () => {
    assertNoMethodWord('blog-course-links', flatten(blogCourseLinks));
  });

  it('термины глоссария: название, short, body, FAQ, SEO-поля (synonyms — намеренно не проверяются)', () => {
    for (const t of GLOSSARY_TERMS) {
      const { synonyms: _synonyms, ...publicFields } = t as Record<string, unknown>;
      assertNoMethodWord(`glossary:${t.slug}`, flatten(publicFields));
    }
  });

  it('тексты бота: FAQ, варианты ответов на возражения, подписи', () => {
    assertNoMethodWord('telegram-bot/faq', flatten([FAQ_CATEGORIES, FAQ_MATCH_ALIASES]));
    assertNoMethodWord('telegram-bot/objection', flatten([OBJECTION_REPLY, OBJECTION_LABEL]));
  });
});
