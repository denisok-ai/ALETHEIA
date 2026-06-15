/**
 * Загрузка knowledge/avaterra.yaml в BrandProfile и theme_pool.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { prisma } from '@/lib/db';
import type { BrandKb } from './types';

const REQUIRED_TOP_KEYS = [
  'brand',
  'audiences',
  'products',
  'author',
  'rubrics',
  'post_types',
  'cta_library',
  'prohibited_phrases',
  'safe_replacements',
  'disclaimer',
  'theme_bank',
] as const;

const DEFAULT_SLUG = 'avaterra';

export function loadKbYamlFromPath(path: string): BrandKb {
  const raw = readFileSync(path, 'utf-8');
  const data = yaml.load(raw) as BrandKb;
  if (!data || typeof data !== 'object') {
    throw new Error('KB YAML must be a mapping');
  }
  const missing = REQUIRED_TOP_KEYS.filter((k) => !(k in data));
  if (missing.length) {
    throw new Error(`KB YAML missing sections: ${missing.join(', ')}`);
  }
  return data;
}

export function defaultKbPath(): string {
  return join(process.cwd(), 'content', 'avaterra.yaml');
}

export function kbVersionFromPayload(kb: BrandKb): string {
  return createHash('sha256').update(JSON.stringify(kb)).digest('hex').slice(0, 16);
}

/** Нормализованный профиль для quality-gates и промптов. */
export function normalizeBrandFromKb(kb: BrandKb) {
  const brand = kb.brand ?? {};
  const tone =
    (brand.tone_of_voice as string | undefined) ||
    (kb.brand?.tone_of_voice as string | undefined) ||
    '';
  return {
    toneOfVoice: tone,
    templates: (kb.post_types ?? []) as Array<Record<string, unknown>>,
    audiences: kb.audiences ?? [],
    products: kb.products ?? {},
    author: kb.author ?? {},
    ctaLibrary: kb.cta_library ?? {},
    prohibitedPhrases: kb.prohibited_phrases ?? [],
    safeReplacements: kb.safe_replacements ?? {},
    disclaimer: kb.disclaimer ?? {},
    quickLinks: (kb.quick_links ?? {}) as Record<string, string>,
    textWhitelist: kb.text_whitelist ?? [],
  };
}

export type KbApplyOutcome = {
  slug: string;
  kbVersion: string;
  audiences: number;
  themesInserted: number;
  themesUpdated: number;
};

export async function applyKbFromFile(yamlPath?: string): Promise<KbApplyOutcome> {
  const path = yamlPath ?? defaultKbPath();
  const kb = loadKbYamlFromPath(path);
  const version = kbVersionFromPayload(kb);
  const tone = (kb.brand?.tone_of_voice as string | undefined) ?? '';

  await prisma.brandProfile.upsert({
    where: { slug: DEFAULT_SLUG },
    create: {
      slug: DEFAULT_SLUG,
      kbVersion: version,
      dataJson: JSON.stringify(kb),
      toneOfVoice: tone,
    },
    update: {
      kbVersion: version,
      dataJson: JSON.stringify(kb),
      toneOfVoice: tone,
    },
  });

  let inserted = 0;
  let updated = 0;
  for (const theme of kb.theme_bank ?? []) {
    const topic = String(theme.topic ?? '').trim();
    if (!topic) continue;
    const postType = String(theme.post_type ?? 'educational');
    const audience = theme.audience ? String(theme.audience) : null;
    const rubric = theme.rubric ? String(theme.rubric) : null;
    const payload = JSON.stringify(
      Object.fromEntries(
        Object.entries(theme).filter(([k]) => !['topic', 'post_type', 'audience', 'rubric'].includes(k))
      )
    );

    const existing = await prisma.themePool.findUnique({
      where: { source_topic: { source: 'kb', topic } },
    });
    if (!existing) {
      await prisma.themePool.create({
        data: {
          topic,
          postType,
          audience,
          rubric,
          priority: 60,
          status: 'pending',
          source: 'kb',
          payload,
        },
      });
      inserted += 1;
    } else {
      await prisma.themePool.update({
        where: { id: existing.id },
        data: { postType, audience, rubric, payload },
      });
      updated += 1;
    }
  }

  return {
    slug: DEFAULT_SLUG,
    kbVersion: version,
    audiences: kb.audiences?.length ?? 0,
    themesInserted: inserted,
    themesUpdated: updated,
  };
}

export async function getBrandProfile() {
  const row = await prisma.brandProfile.findUnique({ where: { slug: DEFAULT_SLUG } });
  if (!row) return null;
  const kb = JSON.parse(row.dataJson) as BrandKb;
  return { row, kb, normalized: normalizeBrandFromKb(kb) };
}
