/**
 * System settings: read from DB with fallback to env.
 * Used server-side for site_url, email sender/recipient, etc.
 */
import { prisma } from './db';
import { decrypt } from './encrypt';

const CACHE_TTL_MS = 60_000; // 1 min
let cache: { at: number; data: SystemSettings } | null = null;

export interface SystemSettings {
  site_url: string;
  portal_title: string;
  resend_from: string;
  resend_notify_email: string;
  contact_phone: string;
}

const ENV_FALLBACK: Record<keyof SystemSettings, string> = {
  site_url: process.env.NEXT_PUBLIC_URL ?? '',
  portal_title: 'AVATERRA',
  resend_from: process.env.RESEND_FROM ?? '',
  resend_notify_email: process.env.RESEND_NOTIFY_EMAIL ?? '',
  contact_phone: '',
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['site_url', 'portal_title', 'resend_from', 'resend_notify_email', 'contact_phone'],
      },
    },
  });

  const byKey: Record<string, string> = {};
  for (const r of rows) byKey[r.key] = r.value;

  const data: SystemSettings = {
    site_url: byKey.site_url || ENV_FALLBACK.site_url,
    portal_title: byKey.portal_title || ENV_FALLBACK.portal_title,
    resend_from: byKey.resend_from || ENV_FALLBACK.resend_from,
    resend_notify_email: byKey.resend_notify_email || ENV_FALLBACK.resend_notify_email,
    contact_phone: byKey.contact_phone || ENV_FALLBACK.contact_phone,
  };

  cache = { at: now, data };
  return data;
}

/** Clear in-memory cache (e.g. after PATCH in admin). */
export function clearSettingsCache(): void {
  cache = null;
  envOverridesCache = null;
}

const ENV_OVERRIDE_KEYS = ['resend_api_key', 'telegram_bot_token', 'cron_secret', 'nextauth_url'] as const;
const ENV_OVERRIDE_SENSITIVE = new Set(['resend_api_key', 'telegram_bot_token', 'cron_secret']);
let envOverridesCache: { at: number; data: Record<string, string> } | null = null;

/**
 * Переменные окружения из БД (с расшифровкой секретов). Используются с приоритетом над process.env.
 */
export async function getEnvOverrides(): Promise<Record<string, string>> {
  const now = Date.now();
  if (envOverridesCache && now - envOverridesCache.at < CACHE_TTL_MS) {
    return envOverridesCache.data;
  }
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...ENV_OVERRIDE_KEYS] } },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const data: Record<string, string> = {};
  for (const k of ENV_OVERRIDE_KEYS) {
    const v = byKey[k];
    if (!v) continue;
    if (ENV_OVERRIDE_SENSITIVE.has(k)) {
      try {
        data[k] = decrypt(v);
      } catch {
        // ignore invalid/missing decryption
      }
    } else {
      data[k] = v;
    }
  }
  envOverridesCache = { at: now, data };
  return data;
}

export function clearEnvOverridesCache(): void {
  envOverridesCache = null;
}

const KNOWLEDGE_BASE_KEY = 'chatbot_knowledge_base';
let knowledgeBaseCache: { at: number; value: string } | null = null;

/** База знаний для чат-бота (из БД). */
export async function getKnowledgeBase(): Promise<string> {
  const now = Date.now();
  if (knowledgeBaseCache && now - knowledgeBaseCache.at < CACHE_TTL_MS) {
    return knowledgeBaseCache.value;
  }
  const row = await prisma.systemSetting.findUnique({
    where: { key: KNOWLEDGE_BASE_KEY },
  });
  const value = row?.value ?? '';
  knowledgeBaseCache = { at: now, value };
  return value;
}

/** Сохранить базу знаний (админ). */
export async function setKnowledgeBase(content: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: KNOWLEDGE_BASE_KEY },
    create: { key: KNOWLEDGE_BASE_KEY, value: content, category: 'ai' },
    update: { value: content },
  });
  knowledgeBaseCache = null;
}

/** Сбросить кэш базы знаний после обновления. */
export function clearKnowledgeBaseCache(): void {
  knowledgeBaseCache = null;
}
