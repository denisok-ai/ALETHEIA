/**
 * Сравнение версий страниц Site Radar.
 */
import { extractKeywords, keywordOverlap } from '../deduplication';
import type { ContentBlock } from './normalizer';

export type BlockChange = {
  changeType: string;
  blockType: string;
  blockKey: string;
  oldText: string | null;
  newText: string | null;
  keywordShift: number;
};

export type PageDiff = {
  newBlocks: BlockChange[];
  updatedBlocks: BlockChange[];
  removedBlocks: BlockChange[];
  hasChanges: boolean;
};

function looksLikeCta(block: ContentBlock): boolean {
  const t = block.text.toLowerCase();
  return ['записать', 'заявку', 'купить', 'оплатить', 'подробнее'].some((m) => t.includes(m));
}

function classifyChange(blockType: string, old: ContentBlock | null, neu: ContentBlock | null): string {
  const c = neu ?? old;
  if (!c) return 'noise';
  if (c.blockType === 'price') return 'price_changed';
  if (c.blockType === 'cta' || looksLikeCta(c)) return 'cta_changed';
  if (c.blockType.startsWith('meta_')) return 'meta_changed';
  if (!old && neu) return 'new_block';
  if (old && !neu) return 'removed_block';
  return 'updated_block';
}

export function diffVersions(oldBlocks: ContentBlock[] | null, newBlocks: ContentBlock[]): PageDiff {
  const oldIndex = new Map((oldBlocks ?? []).map((b) => [b.blockKey, b]));
  const newIndex = new Map(newBlocks.map((b) => [b.blockKey, b]));
  const newBlocksOut: BlockChange[] = [];
  const updated: BlockChange[] = [];
  const removed: BlockChange[] = [];

  for (const [key, nb] of newIndex) {
    const ob = oldIndex.get(key);
    if (!ob) {
      newBlocksOut.push({
        changeType: classifyChange(nb.blockType, null, nb),
        blockType: nb.blockType,
        blockKey: key,
        oldText: null,
        newText: nb.text,
        keywordShift: 1,
      });
      continue;
    }
    if (ob.hash === nb.hash) continue;
    const shift = 1 - keywordOverlap(extractKeywords(ob.text), extractKeywords(nb.text));
    updated.push({
      changeType: classifyChange(nb.blockType, ob, nb),
      blockType: nb.blockType,
      blockKey: key,
      oldText: ob.text,
      newText: nb.text,
      keywordShift: shift,
    });
  }

  for (const [key, ob] of oldIndex) {
    if (newIndex.has(key)) continue;
    removed.push({
      changeType: classifyChange(ob.blockType, ob, null),
      blockType: ob.blockType,
      blockKey: key,
      oldText: ob.text,
      newText: null,
      keywordShift: 1,
    });
  }

  return {
    newBlocks: newBlocksOut,
    updatedBlocks: updated,
    removedBlocks: removed,
    hasChanges: newBlocksOut.length + updated.length + removed.length > 0,
  };
}
