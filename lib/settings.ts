/**
 * System settings: читаются из БД (Портал → Настройки).
 * Используются server-side: site_url, email sender/recipient и т.д.
 * Публичные поля и секреты интеграций: основной источник — БД; при пустых значениях — fallback из process.env (см. docs/Env-Config.md).
 */
import { cache } from 'react';
import { prisma } from './db';
import { decrypt } from './encrypt';
import { applyNextAuthUrlToProcessEnv } from './site-url';

const CACHE_TTL_MS = 60_000; // 1 min
/** Кросс-запросный TTL-кэш. */
let settingsMemCache: { at: number; data: SystemSettings } | null = null;
/** Схлопывает параллельные загрузки до первого ответа БД (гонка при холодном TTL). */
let settingsInFlight: Promise<SystemSettings> | null = null;

export interface SystemSettings {
  site_url: string;
  portal_title: string;
  resend_from: string;
  resend_notify_email: string;
  contact_phone: string;
  company_legal_address: string;
}

/** Значения по умолчанию при отсутствии в БД. Настройки задаются в Портал → Настройки. */
const ENV_FALLBACK: Record<keyof SystemSettings, string> = {
  site_url: '',
  portal_title: 'AVATERRA',
  resend_from: '',
  resend_notify_email: '',
  contact_phone: '',
  company_legal_address: '',
};

async function loadSystemSettingsImpl(): Promise<SystemSettings> {
  const now = Date.now();
  if (settingsMemCache && now - settingsMemCache.at < CACHE_TTL_MS) {
    return settingsMemCache.data;
  }
  if (settingsInFlight) {
    return settingsInFlight;
  }

  settingsInFlight = (async () => {
    try {
      const rows = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              'site_url',
              'portal_title',
              'resend_from',
              'resend_notify_email',
              'contact_phone',
              'company_legal_address',
            ],
          },
        },
      });

      const byKey: Record<string, string> = {};
      for (const r of rows) byKey[r.key] = r.value;

      const data: SystemSettings = {
        site_url: byKey.site_url || process.env.NEXT_PUBLIC_URL?.trim() || ENV_FALLBACK.site_url,
        portal_title: byKey.portal_title || ENV_FALLBACK.portal_title,
        resend_from: byKey.resend_from || process.env.RESEND_FROM?.trim() || ENV_FALLBACK.resend_from,
        resend_notify_email:
          byKey.resend_notify_email || process.env.RESEND_NOTIFY_EMAIL?.trim() || ENV_FALLBACK.resend_notify_email,
        contact_phone: byKey.contact_phone || ENV_FALLBACK.contact_phone,
        company_legal_address: byKey.company_legal_address || ENV_FALLBACK.company_legal_address,
      };

      applyNextAuthUrlToProcessEnv({ siteUrl: data.site_url });

      settingsMemCache = { at: Date.now(), data };
      return data;
    } finally {
      settingsInFlight = null;
    }
  })();

  return settingsInFlight;
}

/**
 * Настройки сайта: один запрос к БД на RSC-запрос (React cache) + TTL между запросами.
 */
export const getSystemSettings = cache(loadSystemSettingsImpl);

/** Clear in-memory cache (e.g. after PATCH in admin). */
export function clearSettingsCache(): void {
  settingsMemCache = null;
  settingsInFlight = null;
  envOverridesCache = null;
  paymentTemplatesCache = null;
  scormMaxSizeCache = null;
}

const ENV_OVERRIDE_KEYS = [
  'resend_api_key',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'nextauth_url',
  'openai_api_key',
  'deepseek_api_key',
] as const;
const ENV_OVERRIDE_SENSITIVE = new Set([
  'resend_api_key',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'openai_api_key',
  'deepseek_api_key',
]);
let envOverridesCache: { at: number; data: Record<string, string> } | null = null;

/** Имена переменных ОС для fallback, если в БД пусто (поэтапная миграция и аварийный запуск). */
const ENV_OVERRIDE_PROCESS_NAMES: Record<(typeof ENV_OVERRIDE_KEYS)[number], string> = {
  resend_api_key: 'RESEND_API_KEY',
  telegram_bot_token: 'TELEGRAM_BOT_TOKEN',
  telegram_webhook_secret: 'TELEGRAM_WEBHOOK_SECRET',
  cron_secret: 'CRON_SECRET',
  nextauth_url: 'NEXTAUTH_URL',
  openai_api_key: 'OPENAI_API_KEY',
  deepseek_api_key: 'DEEPSEEK_API_KEY',
};

/**
 * Секреты и URL интеграций: сначала БД (с расшифровкой), при отсутствии — process.env.
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
    if (v) {
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
  }
  for (const k of ENV_OVERRIDE_KEYS) {
    if (data[k]) continue;
    const envName = ENV_OVERRIDE_PROCESS_NAMES[k];
    const fromOs = envName ? process.env[envName]?.trim() : '';
    if (fromOs) data[k] = fromOs;
  }
  applyNextAuthUrlToProcessEnv({
    explicitNextAuthUrl: data.nextauth_url,
    siteUrl: settingsMemCache?.data?.site_url,
  });
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

// —— Шаблоны писем об оплате (редактируются в настройках без кода) ——
const PAYMENT_EMAIL_KEYS = [
  'email_payment_course_subject',
  'email_payment_course_body',
  'email_payment_generic_subject',
  'email_payment_generic_body',
] as const;

const DEFAULT_PAYMENT_COURSE_SUBJECT = '{{courseTitle}} — доступ открыт';
const DEFAULT_PAYMENT_COURSE_BODY = `<p>Здравствуйте, {{userName}}!</p>
<p>Спасибо за оплату — ваш доступ к материалам курса «{{courseTitle}}» открыт. Войдите в личный кабинет: <a href="{{portalUrl}}">{{portalUrl}}</a> → раздел «Мои курсы».</p>
<p>Чтобы обучение принесло максимум пользы, рекомендуем проходить курс <strong>осознанно и последовательно</strong>: закладывайте регулярное время, следуйте структуре уроков, выполняйте практические задания. При технических вопросах пишите в поддержку: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Условия оплаты, доступа и возврата — на странице <a href="{{ofertaUrl}}#oplata">оферты</a> (разделы оплата, доступ, возврат). Сумма заказа: {{orderAmount}}.</p>
<p>С уважением, команда {{portal_title}}</p>`;

const DEFAULT_PAYMENT_GENERIC_SUBJECT = 'Оплата получена';
const DEFAULT_PAYMENT_GENERIC_BODY = `<p>Здравствуйте, {{userName}}!</p>
<p>Оплата по заказу {{orderid}} получена ({{orderAmount}}). Спасибо!</p>
<p>Личный кабинет: <a href="{{portalUrl}}">{{portalUrl}}</a>. Вопросы: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Условия — в <a href="{{ofertaUrl}}#oplata">оферте</a> (оплата, доступ, возврат).</p>
<p>— {{portal_title}}</p>`;

export interface PaymentEmailTemplates {
  courseSubject: string;
  courseBody: string;
  genericSubject: string;
  genericBody: string;
}

let paymentTemplatesCache: { at: number; data: PaymentEmailTemplates } | null = null;

/** Шаблоны писем об оплате из SystemSetting (плейсхолдеры: {{orderid}}, {{courseTitle}}, {{loginUrl}}, {{successUrl}}, {{portal_title}}). */
export async function getPaymentEmailTemplates(): Promise<PaymentEmailTemplates> {
  const now = Date.now();
  if (paymentTemplatesCache && now - paymentTemplatesCache.at < CACHE_TTL_MS) {
    return paymentTemplatesCache.data;
  }
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...PAYMENT_EMAIL_KEYS] } },
  });
  const byKey: Record<string, string> = {};
  for (const r of rows) byKey[r.key] = r.value;
  const data: PaymentEmailTemplates = {
    courseSubject: byKey.email_payment_course_subject ?? DEFAULT_PAYMENT_COURSE_SUBJECT,
    courseBody: byKey.email_payment_course_body ?? DEFAULT_PAYMENT_COURSE_BODY,
    genericSubject: byKey.email_payment_generic_subject ?? DEFAULT_PAYMENT_GENERIC_SUBJECT,
    genericBody: byKey.email_payment_generic_body ?? DEFAULT_PAYMENT_GENERIC_BODY,
  };
  paymentTemplatesCache = { at: now, data };
  return data;
}

/** Подстановка переменных в шаблон письма об оплате (плейсхолдеры {{ключ}}). */
export function renderPaymentEmailTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) continue;
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return out;
}

/** Сбросить кэш шаблонов писем об оплате (после изменения в админке). */
export function clearPaymentEmailTemplatesCache(): void {
  paymentTemplatesCache = null;
}

// —— Максимальный размер SCORM-пакета (МБ) ——
const SCORM_MAX_SIZE_KEY = 'scorm_max_size_mb';
const DEFAULT_SCORM_MAX_MB = 200;
let scormMaxSizeCache: { at: number; value: number } | null = null;

/** Максимальный размер SCORM ZIP в мегабайтах (из настроек). По умолчанию 200. */
export async function getScormMaxSizeMb(): Promise<number> {
  const now = Date.now();
  if (scormMaxSizeCache && now - scormMaxSizeCache.at < CACHE_TTL_MS) {
    return scormMaxSizeCache.value;
  }
  const row = await prisma.systemSetting.findUnique({
    where: { key: SCORM_MAX_SIZE_KEY },
  });
  const parsed = row?.value ? parseInt(row.value, 10) : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : DEFAULT_SCORM_MAX_MB;
  scormMaxSizeCache = { at: now, value };
  return value;
}

/** Сбросить кэш scorm_max_size_mb (после изменения в админке). */
export function clearScormMaxSizeCache(): void {
  scormMaxSizeCache = null;
}
