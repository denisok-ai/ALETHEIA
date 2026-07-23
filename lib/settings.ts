/**
 * System settings: читаются из БД (Портал → Настройки).
 * Используются server-side: site_url, email sender/recipient и т.д.
 * Публичные поля и секреты интеграций: основной источник — БД; при пустых значениях — fallback из process.env (см. docs/Env-Config.md).
 */
import { cache as reactCache } from 'react';
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
  /**
   * Токен google-site-verification из Search Console.
   *
   * Хранится в БД, а не в .env, намеренно: подтвердить сайт в GSC можно
   * с телефона — вставить токен в Портал → Настройки, без деплоя и SSH.
   * Сайта нет в индексе Google вовсе (аудит 23.07.2026), и подключение
   * Search Console — единственный быстрый способ это изменить.
   */
  google_site_verification: string;
}

/** Значения по умолчанию при отсутствии в БД. Настройки задаются в Портал → Настройки. */
const ENV_FALLBACK: Record<keyof SystemSettings, string> = {
  site_url: '',
  portal_title: 'AVATERRA',
  resend_from: '',
  resend_notify_email: '',
  contact_phone: '',
  company_legal_address: '',
  google_site_verification: '',
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
              'nextauth_url',
              'portal_title',
              'resend_from',
              'resend_notify_email',
              'contact_phone',
              'company_legal_address',
              'google_site_verification',
            ],
          },
        },
      });

      const byKey: Record<string, string> = {};
      for (const r of rows) byKey[r.key] = r.value;

      const nextauthUrlFromDb = byKey.nextauth_url?.trim() || '';

      const data: SystemSettings = {
        site_url: byKey.site_url || process.env.NEXT_PUBLIC_URL?.trim() || ENV_FALLBACK.site_url,
        portal_title: byKey.portal_title || ENV_FALLBACK.portal_title,
        resend_from: byKey.resend_from || process.env.RESEND_FROM?.trim() || ENV_FALLBACK.resend_from,
        resend_notify_email:
          byKey.resend_notify_email || process.env.RESEND_NOTIFY_EMAIL?.trim() || ENV_FALLBACK.resend_notify_email,
        contact_phone: byKey.contact_phone || ENV_FALLBACK.contact_phone,
        company_legal_address: byKey.company_legal_address || ENV_FALLBACK.company_legal_address,
        google_site_verification:
          byKey.google_site_verification ||
          process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
          ENV_FALLBACK.google_site_verification,
      };

      applyNextAuthUrlToProcessEnv({
        explicitNextAuthUrl: nextauthUrlFromDb || undefined,
        siteUrl: data.site_url,
      });

      settingsMemCache = { at: Date.now(), data };
      return data;
    } catch (e) {
      console.error('[getSystemSettings] БД недоступна или ошибка чтения — используем fallback из env', e);
      const data: SystemSettings = {
        site_url: process.env.NEXT_PUBLIC_URL?.trim() || ENV_FALLBACK.site_url,
        portal_title: ENV_FALLBACK.portal_title,
        resend_from: process.env.RESEND_FROM?.trim() || ENV_FALLBACK.resend_from,
        resend_notify_email: process.env.RESEND_NOTIFY_EMAIL?.trim() || ENV_FALLBACK.resend_notify_email,
        contact_phone: ENV_FALLBACK.contact_phone,
        company_legal_address: ENV_FALLBACK.company_legal_address,
        google_site_verification:
          process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || ENV_FALLBACK.google_site_verification,
      };
      try {
        applyNextAuthUrlToProcessEnv({ siteUrl: data.site_url });
      } catch {
        /* ignore */
      }
      return data;
    } finally {
      settingsInFlight = null;
    }
  })();

  return settingsInFlight;
}

/**
 * Настройки сайта: один запрос к БД на RSC-запрос (React cache) + TTL между запросами.
 * В plain Node (tsx, скрипты) `react.cache` недоступен — используем функцию без обёртки.
 */
export const getSystemSettings =
  typeof reactCache === 'function' ? reactCache(loadSystemSettingsImpl) : loadSystemSettingsImpl;

/** Clear in-memory cache (e.g. after PATCH in admin). */
export function clearSettingsCache(): void {
  settingsMemCache = null;
  settingsInFlight = null;
  envOverridesCache = null;
  paymentTemplatesCache = null;
  scormMaxSizeCache = null;
}

const ENV_OVERRIDE_KEYS = [
  'email_transport',
  'resend_api_key',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_password',
  'smtp_secure',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'nextauth_url',
  'openai_api_key',
  'deepseek_api_key',
] as const;
const ENV_OVERRIDE_SENSITIVE = new Set([
  'resend_api_key',
  'smtp_password',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'openai_api_key',
  'deepseek_api_key',
]);
let envOverridesCache: { at: number; data: Record<string, string> } | null = null;

/** Имена переменных ОС для fallback, если в БД пусто (поэтапная миграция и аварийный запуск). */
const ENV_OVERRIDE_PROCESS_NAMES: Record<(typeof ENV_OVERRIDE_KEYS)[number], string> = {
  email_transport: 'EMAIL_TRANSPORT',
  resend_api_key: 'RESEND_API_KEY',
  smtp_host: 'SMTP_HOST',
  smtp_port: 'SMTP_PORT',
  smtp_user: 'SMTP_USER',
  smtp_password: 'SMTP_PASSWORD',
  smtp_secure: 'SMTP_SECURE',
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
          if (k === 'smtp_password') {
            console.warn(
              '[settings] Не удалось расшифровать smtp_password в БД — проверьте NEXTAUTH_SECRET (он же ключ для encrypt/decrypt при сохранении). Письма через SMTP работать не будут.'
            );
          }
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

const DEFAULT_PAYMENT_COURSE_SUBJECT = 'Доступ к курсу открыт — {{courseTitle}}';
const DEFAULT_PAYMENT_COURSE_BODY = `<p>Здравствуйте, {{userName}}!</p>
<p>Спасибо за оплату. Доступ к курсу <strong>«{{courseTitle}}»</strong> открыт.</p>
<p>Следующий шаг: войдите в личный кабинет и откройте раздел <strong>«Мои курсы»</strong>: <a href="{{portalUrl}}">{{portalUrl}}</a>.</p>
<p>Рекомендуем проходить материалы последовательно и выделять регулярное время на практику. Если возникнут вопросы по доступу или оплате, напишите в поддержку: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p style="font-size:14px;color:#5c5854;">Сумма заказа: {{orderAmount}}. Условия оплаты, доступа и возврата доступны в <a href="{{ofertaUrl}}#oplata">оферте</a>.</p>
<p>С уважением,<br/>команда {{portal_title}}</p>`;

const DEFAULT_PAYMENT_GENERIC_SUBJECT = 'Оплата получена — {{portal_title}}';
const DEFAULT_PAYMENT_GENERIC_BODY = `<p>Здравствуйте, {{userName}}!</p>
<p>Мы получили оплату по заказу <strong>{{orderid}}</strong>. Сумма: {{orderAmount}}.</p>
<p>Если заказ связан с обучением, проверьте личный кабинет: <a href="{{portalUrl}}">{{portalUrl}}</a>. Доступы и материалы отображаются в разделе <strong>«Мои курсы»</strong>.</p>
<p>Если доступ не появился или есть вопрос по оплате, напишите в поддержку: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p style="font-size:14px;color:#5c5854;">Условия оплаты, доступа и возврата доступны в <a href="{{ofertaUrl}}#oplata">оферте</a>.</p>
<p>С уважением,<br/>команда {{portal_title}}</p>`;

/** Пустая строка в БД не считается значением — подставляется fallback (как при отправке писем). */
export function resolvePaymentEmailField(stored: string | undefined, fallback: string): string {
  const s = stored?.trim();
  return s ? stored! : fallback;
}

export interface PaymentEmailTemplates {
  courseSubject: string;
  courseBody: string;
  genericSubject: string;
  genericBody: string;
}

/** Типовые тексты по умолчанию (если в БД нет или ключ пустой). Можно импортировать в скриптах upsert. */
export const DEFAULT_PAYMENT_EMAIL_TEMPLATES: PaymentEmailTemplates = {
  courseSubject: DEFAULT_PAYMENT_COURSE_SUBJECT,
  courseBody: DEFAULT_PAYMENT_COURSE_BODY,
  genericSubject: DEFAULT_PAYMENT_GENERIC_SUBJECT,
  genericBody: DEFAULT_PAYMENT_GENERIC_BODY,
};

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
    courseSubject: resolvePaymentEmailField(byKey.email_payment_course_subject, DEFAULT_PAYMENT_COURSE_SUBJECT),
    courseBody: resolvePaymentEmailField(byKey.email_payment_course_body, DEFAULT_PAYMENT_COURSE_BODY),
    genericSubject: resolvePaymentEmailField(byKey.email_payment_generic_subject, DEFAULT_PAYMENT_GENERIC_SUBJECT),
    genericBody: resolvePaymentEmailField(byKey.email_payment_generic_body, DEFAULT_PAYMENT_GENERIC_BODY),
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
