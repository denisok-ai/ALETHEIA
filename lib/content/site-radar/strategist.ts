/**
 * Преобразование сигналов Site Radar в темы theme_pool.
 */
import {
  DuplicateChecker,
  buildMinHash,
  extractKeywords,
  fingerprint,
  type HistoricalFingerprint,
} from '../deduplication';
import type { ScoredSignal } from './scorer';

export type ThemeCandidate = {
  topic: string;
  angle: string;
  postType: string;
  priority: number;
  payload: Record<string, unknown>;
  audience?: string | null;
  rubric?: string | null;
};

function topicForSignal(signal: ScoredSignal, category: string): [string, string, string, string | null, string | null] {
  const summary = signal.summary || '';
  if (signal.signalType === 'new_url') {
    if (category === 'course') {
      return [`Новый курс на сайте: ${summary}`, 'кому подойдёт, мягкий CTA', 'course', 'personal_crisis', 'soft_sales'];
    }
    if (category === 'blog_post' || category === 'blog_index') {
      return [`Новая статья: ${summary}`, 'разбор пользы', 'educational', 'tense_body', 'body_speaks'];
    }
    if (category === 'faq') {
      return [`Новые вопросы FAQ: ${summary}`, 'разбор возражения', 'faq', 'skeptics', 'faq'];
    }
    return [`Новая страница: ${summary}`, 'анонс бренда', 'author', 'specialists', 'student_path'];
  }
  if (signal.changeType === 'price_changed' || signal.changeType === 'cta_changed') {
    return [`Обновление курса: ${summary}`, 'что изменилось', 'course', 'personal_crisis', 'soft_sales'];
  }
  if (category === 'faq') {
    return [`Обновлён FAQ (${summary})`, 'ответ на возражение', 'faq', 'skeptics', 'faq'];
  }
  return [`Обновление (${category}): ${summary}`, 'разбор изменения', 'educational', 'tense_body', 'body_speaks'];
}

export function buildTheme(signal: ScoredSignal, category: string): ThemeCandidate {
  const [topic, angle, postType, audience, rubric] = topicForSignal(signal, category);
  return {
    topic,
    angle,
    postType,
    priority: Math.max(1, Math.min(100, signal.score)),
    payload: {
      category,
      summary: signal.summary,
      changeType: signal.changeType,
      score: signal.score,
      severity: signal.severity,
    },
    audience,
    rubric,
  };
}

export function isDuplicateTopic(topic: string, recentTopics: string[]): boolean {
  if (!recentTopics.length) return false;
  const candidate = fingerprint(topic);
  const history: HistoricalFingerprint[] = recentTopics.map((t, idx) => ({
    referenceId: String(idx),
    minhash: buildMinHash(t),
    keywords: extractKeywords(t),
  }));
  return new DuplicateChecker().check(candidate, history).isDuplicate;
}
