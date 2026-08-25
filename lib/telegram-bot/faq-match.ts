/**
 * Подбор готового ответа из FAQ по свободному вопросу лида.
 *
 * Намеренно без LLM: отвечаем только выверенными текстами школы
 * (`FAQ_CATEGORIES`), поэтому исключены выдумки, обещания результата и
 * медицинские формулировки. Не уверены — молчим и передаём человеку.
 *
 * Метрика — перекрытие значимых слов вопроса с парой «вопрос+ответ», где
 * редкие слова весят больше частых (idf). Плюс два порога: минимальный балл
 * и отрыв от второго кандидата, чтобы не отвечать наугад на похожие темы.
 */
import { FAQ_CATEGORIES } from './faq';

export type FaqMatch = {
  question: string;
  answer: string;
  categoryTitle: string;
  score: number;
};

const STOPWORDS = new Set([
  'и', 'а', 'но', 'что', 'как', 'это', 'ли', 'же', 'бы', 'не', 'ни', 'да', 'нет',
  'в', 'во', 'на', 'по', 'за', 'из', 'от', 'до', 'для', 'при', 'об', 'о', 'с', 'со', 'к', 'у',
  'я', 'мы', 'вы', 'ты', 'он', 'она', 'они', 'мне', 'мной', 'меня', 'вам', 'вас', 'нам',
  'мой', 'моя', 'моё', 'ваш', 'ваша', 'свой', 'своя', 'этот', 'эта', 'эти', 'тот', 'там', 'тут',
  'есть', 'быть', 'был', 'была', 'было', 'буду', 'будет', 'если', 'или', 'то', 'так', 'уже',
  'ещё', 'еще', 'очень', 'можно', 'нужно', 'надо', 'хочу', 'хочется', 'подскажите', 'здравствуйте',
  'добрый', 'день', 'вечер', 'утро', 'привет', 'спасибо', 'пожалуйста',
]);

/** Грубая нормализация: снимаем частые русские окончания, чтобы «курса» = «курс». */
function stem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (w.length <= 4) return w;
  for (const suffix of ['иями', 'ями', 'ами', 'ого', 'ему', 'ому', 'ыми', 'ими', 'ах', 'ях', 'ов', 'ев', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ем', 'ом', 'ой', 'ей', 'ую', 'юю', 'ии', 'ия', 'ие', 'ых', 'их', 'у', 'ю', 'а', 'я', 'ы', 'и', 'о', 'е', 'ь']) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) return w.slice(0, -suffix.length);
  }
  return w;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

type IndexedItem = {
  question: string;
  answer: string;
  categoryTitle: string;
  /** Слова самого вопроса — они решают: совпадение по теме, а не по фону. */
  qTokens: Set<string>;
  /** Слова ответа — только подтверждают, вес ниже. */
  aTokens: Set<string>;
};

let indexCache: { items: IndexedItem[]; idf: Map<string, number> } | null = null;

function buildIndex() {
  if (indexCache) return indexCache;
  const items: IndexedItem[] = [];
  for (const category of FAQ_CATEGORIES) {
    for (const item of category.items) {
      items.push({
        question: item.q,
        answer: item.a,
        categoryTitle: category.title,
        qTokens: new Set(tokenize(item.q)),
        aTokens: new Set(tokenize(item.a)),
      });
    }
  }
  const df = new Map<string, number>();
  for (const item of items) {
    for (const token of new Set([...item.qTokens, ...item.aTokens])) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [token, count] of df) idf.set(token, Math.log(items.length / count) + 0.2);
  indexCache = { items, idf };
  return indexCache;
}

const Q_WEIGHT = 2; // слово из формулировки вопроса
const A_WEIGHT = 0.5; // то же слово, но встреченное лишь в тексте ответа
const MIN_SCORE = 4; // ниже — вопрос слишком общий, отвечать наугад нельзя
const MIN_MARGIN = 1.2; // во сколько раз лучший ответ должен превосходить второй
const MIN_Q_HITS = 2; // сколько слов вопроса обязаны совпасть с вопросом из FAQ
const MIN_COVERAGE = 0.4; // какая доля значимых слов вопроса должна найтись
// Одного совпадения хватает, только если слово редкое («лечение», «партнёр»):
// формулировки в FAQ короткие, и по одному меткому слову тема опознаётся точно.
const RARE_HIT_IDF = 2.2;
const RARE_HIT_COVERAGE = 0.5;
const RARE_HIT_SCORE = 6;

/**
 * Найти ответ на свободный вопрос. Возвращает null, если уверенности нет —
 * это нормальный и частый исход, вопрос уходит живому специалисту.
 */
export function matchFaqAnswer(text: string): FaqMatch | null {
  const tokens = tokenize(text);
  if (tokens.length < 2) return null;

  const { items, idf } = buildIndex();
  const unique = new Set(tokens);
  const scored = items
    .map((item) => {
      let score = 0;
      let qHits = 0;
      let qIdf = 0;
      let hits = 0;
      for (const token of unique) {
        const weight = idf.get(token) ?? 0.2;
        if (item.qTokens.has(token)) {
          score += weight * Q_WEIGHT;
          qHits += 1;
          qIdf += weight;
          hits += 1;
        } else if (item.aTokens.has(token)) {
          score += weight * A_WEIGHT;
          hits += 1;
        }
      }
      return { item, score, qHits, qIdf, coverage: hits / unique.size };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < MIN_SCORE) return null;
  // Совпало только «фоном» в тексте ответа — тема, скорее всего, другая.
  const solidMatch = best.qHits >= MIN_Q_HITS && best.coverage >= MIN_COVERAGE;
  const rareMatch =
    best.qHits === 1 &&
    best.qIdf >= RARE_HIT_IDF &&
    best.coverage >= RARE_HIT_COVERAGE &&
    best.score >= RARE_HIT_SCORE;
  if (!solidMatch && !rareMatch) return null;
  if (second && second.score > 0 && best.score < second.score * MIN_MARGIN) return null;

  return {
    question: best.item.question,
    answer: best.item.answer,
    categoryTitle: best.item.categoryTitle,
    score: Number(best.score.toFixed(2)),
  };
}
