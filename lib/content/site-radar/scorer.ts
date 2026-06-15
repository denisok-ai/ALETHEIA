/**
 * Скоринг сигналов Site Radar.
 */
import type { BlockChange } from './diff';
import { isCommercialCategory } from './categorizer';

const WEIGHTS: Record<string, number> = {
  new_block: 25,
  updated_block: 15,
  removed_block: 12,
  price_changed: 35,
  cta_changed: 25,
  meta_changed: 10,
  noise: 0,
};

export type ScoredSignal = {
  signalType: string;
  changeType: string;
  score: number;
  severity: string;
  summary: string;
  payload: Record<string, unknown>;
};

function severity(score: number): string {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export function scoreBlockChange(change: BlockChange, category: string): ScoredSignal {
  const base = WEIGHTS[change.changeType] ?? 0;
  const bonus = isCommercialCategory(category) ? 15 : 0;
  const score = Math.max(0, base + bonus + Math.round(change.keywordShift * 10));
  const summary = (change.newText || change.oldText || change.blockType || change.changeType).slice(0, 200);
  return {
    signalType: 'page_change',
    changeType: change.changeType,
    score,
    severity: severity(score),
    summary,
    payload: {
      blockType: change.blockType,
      blockKey: change.blockKey,
      keywordShift: change.keywordShift,
      oldText: (change.oldText ?? '').slice(0, 500),
      newText: (change.newText ?? '').slice(0, 500),
    },
  };
}

export function scoreNewUrl(url: string, category: string): ScoredSignal {
  let score = 50;
  if (category === 'course') score = 80;
  else if (category === 'blog_post' || category === 'blog_index') score = 35;
  else if (category === 'home' || category === 'faq') score = 65;
  return {
    signalType: 'new_url',
    changeType: 'new_url',
    score,
    severity: severity(score),
    summary: url,
    payload: { url, category },
  };
}

export function scoreRemovedUrl(url: string, category: string): ScoredSignal {
  const score = category === 'course' || category === 'home' ? 30 : 15;
  return {
    signalType: 'removed_url',
    changeType: 'removed_url',
    score,
    severity: severity(score),
    summary: url,
    payload: { url, category },
  };
}

export function scorePageDiff(
  diff: { newBlocks: BlockChange[]; updatedBlocks: BlockChange[]; removedBlocks: BlockChange[] },
  category: string
): ScoredSignal[] {
  const all = [...diff.newBlocks, ...diff.updatedBlocks, ...diff.removedBlocks];
  return all
    .filter((c) => c.changeType !== 'noise')
    .map((c) => scoreBlockChange(c, category))
    .filter((s) => s.score > 0);
}
