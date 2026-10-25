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
const SKIP = new Set(['kurs-telo-znaet-vse', 'kurs-probuzhdenie', 'tatyana-streltsova']);

function stem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const cut = w.replace(/[аяоеиыуюйь]{1,2}$/u, '');
  // Слишком короткая основа даёт ложные совпадения — оставляем слово целиком.
  return cut.length >= 4 ? cut : w;
}

type PhraseMatcher = {
  re: RegExp;
  /** Первое слово фразы (нижний регистр, ё → е) и его основа — для оценки совпадения. */
  first: string;
  firstStem: string;
};

function phraseMatcher(phrase: string): PhraseMatcher | null {
  const words = phrase
    .replace(/[«»"“”()]/g, ' ')
    .split(/[\s/-]+/)
    .filter((w) => /^[а-яё]+$/i.test(w));
  if (!words.length || words.join('').length < 5) return null;
  const parts = words.map((w) => `${stem(w).replace(/е/g, '[её]')}[а-яё]{0,4}`);
  const first = words[0].toLowerCase().replace(/ё/g, 'е');
  return {
    re: new RegExp(`(^|[^а-яё])${parts.join('[\\s«»"“”/-]+')}(?![а-яё])`, 'giu'),
    first,
    firstStem: stem(first),
  };
}

/**
 * Насколько форма слова в тексте похожа на слово термина. Нужно, когда на одном
 * месте совпадают два термина с общей основой: «кинезиология» (синоним прикладной
 * кинезиологии) после отрезания окончания даёт ту же основу, что «кинезиолог»
 * (25.10.2026 слово «кинезиолог» в статьях первым вело на прикладную кинезиологию).
 * 3 — слово совпало целиком; 2 — окончание той же «семьи», что у слова термина
 * («кинезиологии» для «кинезиология»); 1 — у слова термина окончание не отрезалось,
 * хвост любой; 0 — окончание чужое («кинезиолог» для «кинезиология»).
 */
function formScore(m: PhraseMatcher, textFromMatch: string): number {
  const word = textFromMatch.match(/^[а-яё]+/u)?.[0] ?? '';
  if (word === m.first) return 3;
  const removed = m.first.slice(m.firstStem.length);
  if (!removed) return 1;
  const tail = word.slice(m.firstStem.length);
  return tail !== '' && tail[0] === removed[0] ? 2 : 0;
}

const MATCHERS: Array<{ term: GlossaryTerm; matchers: PhraseMatcher[] }> = GLOSSARY_TERMS.filter(
  (t) => !SKIP.has(t.slug)
).map((term) => ({
  term,
  matchers: [term.term, ...(term.synonyms ?? [])]
    .map(phraseMatcher)
    .filter((m): m is PhraseMatcher => m !== null),
}));

/** Термины в порядке первого упоминания в тексте; ссылки уже на этот термин не дублируются. */
export function findGlossaryTerms(text: string, limit = 6): GlossaryTerm[] {
  const plain = text.toLowerCase().replace(/ё/g, 'е');
  // На одном месте текста — один термин: тот, чья форма слова ближе (formScore);
  // при равенстве — первый по порядку словаря, как и раньше.
  const best = new Map<number, { term: GlossaryTerm; score: number }>();
  for (const { term, matchers } of MATCHERS) {
    if (plain.includes(`/glossary/${term.slug}`)) continue;
    for (const m of matchers) {
      m.re.lastIndex = 0;
      for (let hit = m.re.exec(plain); hit; hit = m.re.exec(plain)) {
        const at = hit.index + hit[1].length;
        const score = formScore(m, plain.slice(at));
        const cur = best.get(at);
        if (!cur || score > cur.score) best.set(at, { term, score });
      }
    }
  }
  const seen = new Set<string>();
  const ordered: GlossaryTerm[] = [];
  for (const at of [...best.keys()].sort((a, b) => a - b)) {
    const { term } = best.get(at)!;
    if (seen.has(term.slug)) continue;
    seen.add(term.slug);
    ordered.push(term);
  }
  return ordered.slice(0, limit);
}
