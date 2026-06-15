/**
 * Конфигурация SMM-пайплайна и Site Radar (env + SystemSetting).
 */
import { prisma } from '@/lib/db';
import { getEnvOverrides } from '@/lib/settings';

export type ContentPublishMode = 'dry_run' | 'auto';

export type ContentConfig = {
  siteUrl: string;
  contentChannelId: string;
  dryRun: boolean;
  autoPublish: boolean;
  paused: boolean;
  postsPerWeek: number;
  publishHour: number;
  publishMinute: number;
  dedupLookbackPosts: number;
  dedupJaccardThreshold: number;
  dedupKeywordThreshold: number;
  qualityMaxRetries: number;
  imageGenerationEnabled: boolean;
  kbYamlPath: string;
  timezone: string;
};

const SETTING_KEYS = [
  'content_dry_run',
  'content_auto_publish',
  'content_paused',
  'content_channel_id',
] as const;

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
  return row?.value?.trim() || null;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getContentConfig(): Promise<ContentConfig> {
  const overrides = await getEnvOverrides();
  const settings = Object.fromEntries(
    await Promise.all(
      SETTING_KEYS.map(async (k) => [k, await readSetting(k)] as const)
    )
  );

  const dryRunSetting = settings.content_dry_run;
  const autoSetting = settings.content_auto_publish;
  const pausedSetting = settings.content_paused;
  const channelSetting = settings.content_channel_id;

  return {
    siteUrl: (process.env.NEXT_PUBLIC_URL ?? 'https://avaterra.pro').replace(/\/$/, ''),
    contentChannelId:
      channelSetting ||
      process.env.CONTENT_CHANNEL_ID?.trim() ||
      process.env.TARGET_CHANNEL_ID?.trim() ||
      '',
    dryRun: dryRunSetting != null ? dryRunSetting !== 'false' : envBool('CONTENT_DRY_RUN', true),
    autoPublish: autoSetting === 'true' || envBool('CONTENT_AUTO_PUBLISH', false),
    paused: pausedSetting === 'true' || envBool('CONTENT_PAUSED', false),
    postsPerWeek: envInt('CONTENT_POSTS_PER_WEEK', 7),
    publishHour: envInt('CONTENT_PUBLISH_HOUR', 11),
    publishMinute: envInt('CONTENT_PUBLISH_MINUTE', 0),
    dedupLookbackPosts: envInt('CONTENT_DEDUP_LOOKBACK', 60),
    dedupJaccardThreshold: parseFloat(process.env.CONTENT_DEDUP_JACCARD ?? '0.55'),
    dedupKeywordThreshold: parseFloat(process.env.CONTENT_DEDUP_KEYWORD ?? '0.7'),
    qualityMaxRetries: envInt('CONTENT_QUALITY_MAX_RETRIES', 2),
    imageGenerationEnabled: envBool('IMAGE_GENERATION_ENABLED', false),
    kbYamlPath: process.env.KB_YAML_PATH?.trim() || 'content/avaterra.yaml',
    timezone: process.env.TZ?.trim() || 'Europe/Moscow',
  };
}

export async function setContentSetting(key: (typeof SETTING_KEYS)[number], value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, category: 'content' },
    update: { value },
  });
}

export async function isEffectiveDryRun(config?: ContentConfig): Promise<boolean> {
  const c = config ?? (await getContentConfig());
  return c.dryRun || !c.autoPublish || !c.contentChannelId;
}
