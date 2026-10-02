/**
 * Термины глоссария, упомянутые в тексте статьи, — для блока «Термины из
 * статьи» под статьёй блога.
 *
 * Зачем (SEO-цикл 03.10.2026): страницы глоссария показываются по НЧ-запросам
 * на позициях 6–12, а ни одна из 42 статей на них не ссылалась — внутренний
 * вес шёл только от индекса /glossary. Ссылки со статей по смыслу передают
 * вес и дают читателю короткое определение.
 *
 * Русская морфология без словаря: у каждого слова термина отрезаем окончание
 * (гласные/й/ь, до двух букв) и ищем основу с коротким хвостом (до 4 букв) —
 * «эмоциональный заряд» находит «эмоционального заряда», «установка» —
 * «установки», но «установка» не ловит «установить».
 */
import { GLOSSARY_TERMS, type GlossaryTerm } from './glossary';

/** Термины-сущности (курсы, автор) статьи и так ведут в курс/на /about. */
const SKIP = new Set(['kurs-telo-ne-vret', 'kurs-probuzhdenie', 'tatyana-streltsova']);

function stem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const cut = w.replace(/[аяоеиыуюйь]{1,2}$/u, '');
  // Слишком короткая основа даёт ложные совпадения — оставляем слово целиком.
  return cut.length >= 4 ? cut : w;
}

function phraseRegex(phrase: string): RegExp | null {
  const words = phrase
    .replace(/[«»"“”()]/g, ' ')
    .split(/[\s/-]+/)
    .filter((w) => /^[а-яё]+$/i.test(w));
  if (!words.length || words.join('').length < 5) return null;
  const parts = words.map((w) => `${stem(w).replace(/е/g, '[её]')}[а-яё]{0,4}`);
  return new RegExp(`(^|[^а-яё])${parts.join('[\\s«»"“”/-]+')}(?![а-яё])`, 'iu');
}

const MATCHERS: Array<{ term: GlossaryTerm; res: RegExp[] }> = GLOSSARY_TERMS.filter((t) => !SKIP.has(t.slug)).map(
  (term) => ({
    term,
    res: [term.term, ...(term.synonyms ?? [])].map(phraseRegex).filter((r): r is RegExp => r !== null),
  })
);

/** Термины в порядке первого упоминания в тексте; ссылки уже на этот термин не дублируются. */
export function findGlossaryTerms(text: string, limit = 6): GlossaryTerm[] {
  const plain = text.toLowerCase().replace(/ё/g, 'е');
  const found: Array<{ term: GlossaryTerm; at: number }> = [];
  for (const { term, res } of MATCHERS) {
    if (plain.includes(`/glossary/${term.slug}`)) continue;
    let at = -1;
    for (const re of res) {
      const m = re.exec(plain);
      if (m && (at < 0 || m.index < at)) at = m.index;
    }
    if (at >= 0) found.push({ term, at });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map((f) => f.term);
}
