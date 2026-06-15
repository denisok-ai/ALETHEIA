/**
 * Генерация текста поста через DeepSeek (lib/llm-chat-completion).
 */
import { prisma } from '@/lib/db';
import { getLlmApiKey } from '@/lib/llm';
import { completeLlmChat } from '@/lib/llm-chat-completion';
import { getBrandProfile } from '../brand-kb';
import { getContentConfig } from '../config';
import {
  DuplicateChecker,
  deserializeMinhash,
  fingerprint,
  serializeMinhash,
  type HistoricalFingerprint,
} from '../deduplication';
import { buildTextPrompts } from '../prompts';
import { evaluateText, normalizePostLexicon } from '../quality-gates';

export type TextGenOutcome = {
  ok: boolean;
  status: string;
  text?: string;
  qualityCodes?: string[];
};

async function loadDedupHistory(limit: number) {
  const rows = await prisma.contentItem.findMany({
    where: { status: { in: ['ready', 'approved', 'published'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: { id: true, generatedText: true, finalText: true, dedupSignature: true, dedupKeywords: true },
  });
  return rows
    .map((r) => {
      const text = r.finalText || r.generatedText;
      if (!text) return null;
      if (r.dedupSignature && r.dedupKeywords) {
        try {
          return {
            referenceId: r.id,
            minhash: deserializeMinhash(r.dedupSignature),
            keywords: JSON.parse(r.dedupKeywords) as string[],
          } satisfies HistoricalFingerprint;
        } catch {
          /* fallback */
        }
      }
      const fp = fingerprint(text);
      return { referenceId: r.id, minhash: fp.minhash, keywords: fp.keywords };
    })
    .filter(Boolean) as HistoricalFingerprint[];
}

export async function generateTextForItem(itemId: string, feedback?: string): Promise<TextGenOutcome> {
  const item = await prisma.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, status: 'not_found' };

  const brandRow = await getBrandProfile();
  if (!brandRow) return { ok: false, status: 'no_brand_kb' };
  const brand = brandRow.normalized;
  const config = await getContentConfig();

  await prisma.contentItem.update({ where: { id: itemId }, data: { status: 'generating' } });

  const apiKey = await getLlmApiKey('chatbot');
  if (!apiKey) {
    await prisma.contentItem.update({ where: { id: itemId }, data: { status: 'quality_failed' } });
    return { ok: false, status: 'no_api_key' };
  }

  let lastFeedback = feedback ?? '';
  for (let attempt = 0; attempt <= config.qualityMaxRetries; attempt++) {
    const [system, user] = buildTextPrompts(brand, {
      postType: item.postType,
      topic: item.topic,
      objective: item.objective ?? '',
      outline: item.outline ?? '',
      cta: item.cta ?? '',
      audienceId: item.audience,
      rubricId: item.rubric,
      feedback: lastFeedback || null,
    });

    const result = await completeLlmChat({
      provider: 'deepseek',
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 2000,
      temperature: 0.7,
    });

    if (!result.ok) {
      await prisma.contentItem.update({ where: { id: itemId }, data: { status: 'quality_failed' } });
      return { ok: false, status: 'llm_error' };
    }

    const text = normalizePostLexicon(result.content.trim());
    const report = evaluateText({ text, topic: item.topic, postType: item.postType, brand });
    if (!report.passed) {
      lastFeedback = report.feedbackForRetry();
      if (attempt < config.qualityMaxRetries) continue;
      await prisma.contentItem.update({
        where: { id: itemId },
        data: {
          generatedText: text,
          status: 'quality_failed',
          qualityIssues: JSON.stringify(report.issues),
        },
      });
      return { ok: false, status: 'quality_failed', text, qualityCodes: report.issues.map((i) => i.code) };
    }

    const fp = fingerprint(text);
    const history = await loadDedupHistory(config.dedupLookbackPosts);
    const dup = new DuplicateChecker(config.dedupJaccardThreshold, config.dedupKeywordThreshold).check(fp, history);
    if (dup.isDuplicate) {
      await prisma.contentItem.update({
        where: { id: itemId },
        data: {
          generatedText: text,
          status: 'dedup_blocked',
          dedupSignature: serializeMinhash(fp.minhash),
          dedupKeywords: JSON.stringify(fp.keywords),
        },
      });
      return { ok: false, status: 'dedup_blocked', text };
    }

    await prisma.contentItem.update({
      where: { id: itemId },
      data: {
        generatedText: text,
        finalText: text,
        status: 'ready',
        qualityIssues: null,
        dedupSignature: serializeMinhash(fp.minhash),
        dedupKeywords: JSON.stringify(fp.keywords),
      },
    });
    return { ok: true, status: 'ready', text };
  }

  return { ok: false, status: 'quality_failed' };
}

export async function listQualityQueue(): Promise<string> {
  const rows = await prisma.contentItem.findMany({
    where: { status: { in: ['quality_failed', 'dedup_blocked'] } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });
  if (!rows.length) return 'Очередь quality пуста.';
  return rows
    .map((r, i) => {
      const issues = r.qualityIssues
        ? (JSON.parse(r.qualityIssues) as { code: string }[]).map((x) => x.code).join(', ')
        : '—';
      return `${i + 1}. <code>${r.id.slice(0, 8)}</code> · ${r.status} · ${r.postType}\n   ${r.topic.slice(0, 60)}\n   issues: ${issues}`;
    })
    .join('\n\n');
}
