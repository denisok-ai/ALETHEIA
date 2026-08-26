/**
 * Тематическая перелинковка блога («Читайте также»).
 *
 * SEO-2026: HowTo/FAQ rich results в Google мертвы, а topical authority —
 * работает. Раньше «Читайте также» брал соседей по ленте (структурная связь для
 * обхода роботом, но не тематическая). Теперь: сперва статьи ТОЙ ЖЕ темы —
 * тематические кластеры усиливают релевантность раздела, — а недостающие места
 * добираем соседями по дате, чтобы каждая статья осталась достижимой.
 *
 * Темы выводим из ключевых слов (у постов нет тегов). Детерминированно, чистая
 * функция — без БД и внешних вызовов.
 */

export type RelatedPost = { slug: string; title: string; publishedAt: string };

/** Тематические кластеры школы: тема → ключевые основы слов (по вхождению подстроки). */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  method: ['myshechn', 'testirovani', 'kineziolog', 'metod', 'lobny', 'sverka', 'balans', 'test'],
  emotions: ['emots', 'zaryad', 'karta', 'obid', 'strah', 'konflikt', 'proyavl'],
  body: ['telo', 'telesn', 'ustalost', 'napryazh', 'stress', 'psihosomat'],
  life: ['dengi', 'otnosheni', 'samorealiz', 'avtopilot', 'krizis', 'menyaets'],
  learning: ['kurs', 'obucheni', 'format', 'sessi', 'vybrat', 'psiholog', 'individ', 'grupp'],
  practice: ['praktik', 'osoznann', 'nachat', 'probuzhd'],
};

/** Темы статьи по её слагу (латиница транслита уже в слаге). */
export function topicsOf(slug: string): Set<string> {
  const s = slug.toLowerCase();
  const topics = new Set<string>();
  for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
    if (keys.some((k) => s.includes(k))) topics.add(topic);
  }
  return topics;
}

/** Число общих тем — вес тематической близости. */
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

/**
 * Подобрать до `limit` связанных статей для `currentSlug`.
 * `all` — все опубликованные, в порядке ленты (новые сверху).
 */
export function computeRelated<T extends RelatedPost>(currentSlug: string, all: T[], limit = 3): T[] {
  const others = all.filter((p) => p.slug !== currentSlug);
  if (others.length === 0) return [];

  const mine = topicsOf(currentSlug);
  const picked = new Map<string, T>();

  // 1) Тематические соседи — по убыванию числа общих тем, свежие раньше при равенстве.
  const byTopic = others
    .map((p) => ({ p, score: overlap(mine, topicsOf(p.slug)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.p.publishedAt < b.p.publishedAt ? 1 : -1));
  for (const { p } of byTopic) {
    if (picked.size >= limit) break;
    picked.set(p.slug, p);
  }

  // 2) Добор соседями по ленте — чтобы у любой статьи были входящие ссылки
  //    и робот мог обойти раздел даже там, где тем не нашлось.
  if (picked.size < limit) {
    const idx = all.findIndex((p) => p.slug === currentSlug);
    const neighbours = [all[idx - 1], all[idx + 1]].filter(Boolean) as T[];
    for (const p of neighbours) {
      if (picked.size >= limit) break;
      if (p.slug !== currentSlug) picked.set(p.slug, p);
    }
  }

  // 3) Если всё ещё не хватает (мало статей) — добираем со сдвигом по слагу,
  //    чтобы связи не сходились в одни и те же свежие статьи.
  if (picked.size < limit && others.length > 0) {
    const shift = [...currentSlug].reduce((a, c) => a + c.charCodeAt(0), 0) % others.length;
    for (let i = 0; i < others.length && picked.size < limit; i++) {
      const cand = others[(shift + i) % others.length];
      picked.set(cand.slug, cand);
    }
  }

  return [...picked.values()].slice(0, limit);
}
