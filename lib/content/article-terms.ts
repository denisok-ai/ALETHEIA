/**
 * Блок «Термины по теме» под статьёй блога: 2–4 термина глоссария.
 *
 * Порядок выбора:
 * 1. термины, у которых в поле `articles` указана эта статья (связь задана в глоссарии);
 * 2. если таких меньше двух — термины того же тематического кластера, что и статья
 *    (те же ключевые основы слов, что в lib/content/blog-related.ts, topicsOf);
 * 3. если и так меньше двух — несколько ядровых терминов школы.
 *
 * Не выводим то, что уже показано в статье: термины из текста (блок «Термины из статьи»,
 * findGlossaryTerms) и термины, на которые статья уже ссылается сама. Курсы и автор — не
 * термины: у них своя страница и блок курса под статьёй, поэтому их пропускаем.
 *
 * Чистая функция: без БД и сети, покрыта тестами (tests/unit/article-terms.test.ts).
 */
import { findGlossaryTerms } from './glossary-links';
import { GLOSSARY_TERMS, type GlossaryTerm } from './glossary';
import { topicsOf } from './blog-related';

/** Сколько терминов хотим минимум и сколько максимум в блоке. */
const MIN_TERMS = 2;
const MAX_TERMS = 4;

/** Курсы и автор — сущности, не термины (см. SKIP в glossary-links.ts). */
const ENTITY_SLUGS = new Set(['kurs-telo-znaet-vse', 'kurs-probuzhdenie', 'tatyana-streltsova']);

/** Ядро словаря школы — запасной набор, если ни связей, ни кластера не нашлось. */
const CORE_TERM_SLUGS = ['myshechnoe-testirovanie', 'kineziolog', 'praktika-prisutstviya'];

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

/**
 * Термины для блока «Термины по теме».
 * @param articleSlug слаг статьи блога
 * @param bodyText текст статьи (markdown или абзацы через перевод строки) — чтобы не повторять ссылки из тела
 */
export function articleTerms(articleSlug: string, bodyText = ''): GlossaryTerm[] {
  const shownInBody = new Set(findGlossaryTerms(bodyText).map((t) => t.slug));
  for (const t of GLOSSARY_TERMS) {
    if (bodyText.includes(`/glossary/${t.slug}`)) shownInBody.add(t.slug);
  }
  const usable = GLOSSARY_TERMS.filter((t) => !ENTITY_SLUGS.has(t.slug) && !shownInBody.has(t.slug));

  const picked: GlossaryTerm[] = usable.filter((t) => t.articles?.includes(articleSlug)).slice(0, MAX_TERMS);
  const has = (slug: string) => picked.some((t) => t.slug === slug);

  if (picked.length < MIN_TERMS) {
    // Тематический кластер: сперва термины с большим числом общих тем, при равенстве — порядок глоссария.
    const mine = topicsOf(articleSlug);
    const byTopic = usable
      .filter((t) => !has(t.slug))
      .map((t) => ({ t, score: overlap(mine, topicsOf(t.slug)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    for (const { t } of byTopic) {
      if (picked.length >= MIN_TERMS) break;
      picked.push(t);
    }
  }

  if (picked.length < MIN_TERMS) {
    for (const slug of CORE_TERM_SLUGS) {
      if (picked.length >= MIN_TERMS) break;
      const t = usable.find((x) => x.slug === slug);
      if (t && !has(slug)) picked.push(t);
    }
  }

  return picked;
}
