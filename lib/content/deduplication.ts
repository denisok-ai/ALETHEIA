/**
 * Антидубли публикаций: шинглы, MinHash, Jaccard, ключевые слова.
 */
const RU_STOPWORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но',
  'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня',
  'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'если', 'уже', 'или', 'ни', 'быть', 'был',
  'до', 'вас', 'опять', 'вам', 'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть',
  'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'раз', 'тоже', 'под', 'будет',
  'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой',
  'тем', 'чтобы', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'можно', 'при', 'наконец', 'два', 'об', 'другой',
  'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них',
]);

const NUM_PERM = 128;
const SHINGLE_SIZE = 3;

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+|t\.me\/\S+/g, ' ')
    .replace(/[^\w\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return (normalize(text).match(/[\w\-]+/g) ?? []).filter(
    (t) => t.length >= 3 && !RU_STOPWORDS.has(t) && !/^\d+$/.test(t)
  );
}

function shingles(tok: string[], size: number): string[] {
  if (tok.length < size) return tok.length ? [tok.join(' ')] : [];
  const out: string[] = [];
  for (let i = 0; i <= tok.length - size; i++) out.push(tok.slice(i, i + size).join(' '));
  return out;
}

export function extractKeywords(text: string, topN = 25): string[] {
  const tok = tokens(text);
  const counts = new Map<string, number>();
  for (const t of tok) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k]) => k);
}

export function buildMinHash(text: string): Uint32Array {
  const sig = new Uint32Array(NUM_PERM);
  sig.fill(Number.MAX_SAFE_INTEGER);
  for (const sh of shingles(tokens(text), SHINGLE_SIZE)) {
    const base = fnv1a(sh);
    for (let i = 0; i < NUM_PERM; i++) {
      const h = fnv1a(`${base}:${i}`);
      if (h < sig[i]) sig[i] = h;
    }
  }
  return sig;
}

export function serializeMinhash(mh: Uint32Array): string {
  return Buffer.from(mh.buffer).toString('base64');
}

export function deserializeMinhash(payload: string): Uint32Array {
  const buf = Buffer.from(payload, 'base64');
  return new Uint32Array(buf.buffer, buf.byteOffset, NUM_PERM);
}

export function minhashJaccard(a: Uint32Array, b: Uint32Array): number {
  let same = 0;
  for (let i = 0; i < NUM_PERM; i++) if (a[i] === b[i]) same += 1;
  return same / NUM_PERM;
}

export function keywordOverlap(a: Iterable<string>, b: Iterable<string>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size && !setB.size) return 0;
  let inter = 0;
  setA.forEach((x) => {
    if (setB.has(x)) inter += 1;
  });
  let unionSize = setA.size;
  setB.forEach((x) => {
    if (!setA.has(x)) unionSize += 1;
  });
  return unionSize ? inter / unionSize : 0;
}

export type PostFingerprint = {
  minhash: Uint32Array;
  keywords: string[];
  normalizedLength: number;
};

export function fingerprint(text: string): PostFingerprint {
  const tok = tokens(text);
  return {
    minhash: buildMinHash(text),
    keywords: extractKeywords(text),
    normalizedLength: tok.length,
  };
}

export type HistoricalFingerprint = {
  referenceId: string;
  minhash: Uint32Array;
  keywords: string[];
};

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  reason?: string;
  bestSimilarity: number;
};

export class DuplicateChecker {
  constructor(
    private jaccardThreshold = 0.55,
    private keywordThreshold = 0.7
  ) {}

  check(candidate: PostFingerprint, history: HistoricalFingerprint[]): DuplicateCheckResult {
    let best = 0;
    for (const item of history) {
      const sim = minhashJaccard(candidate.minhash, item.minhash);
      best = Math.max(best, sim);
      if (sim >= this.jaccardThreshold) {
        return { isDuplicate: true, reason: 'minhash_similarity', bestSimilarity: sim };
      }
      const overlap = keywordOverlap(candidate.keywords, item.keywords);
      if (overlap >= this.keywordThreshold) {
        return { isDuplicate: true, reason: 'keyword_overlap', bestSimilarity: overlap };
      }
    }
    return { isDuplicate: false, bestSimilarity: best };
  }
}
