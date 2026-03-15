/**
 * System settings: читаются из БД (Портал → Настройки).
 * Используются server-side: site_url, email sender/recipient и т.д.
 * Переменные окружения (.env) не используются — настройки вынесены в админку.
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

/** Значения по умолчанию при отсутствии в БД. Настройки задаются в Портал → Настройки. */
const ENV_FALLBACK: Record<keyof SystemSettings, string> = {
  site_url: '',
  portal_title: 'AVATERRA',
  resend_from: '',
  resend_notify_email: '',
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
  paymentTemplatesCache = null;
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

// —— Шаблоны писем об оплате (редактируются в настройках без кода) ——
const PAYMENT_EMAIL_KEYS = [
  'email_payment_course_subject',
  'email_payment_course_body',
  'email_payment_generic_subject',
  'email_payment_generic_body',
] as const;

const DEFAULT_PAYMENT_COURSE_SUBJECT = 'Оплата получена — доступ к курсу открыт';
const DEFAULT_PAYMENT_COURSE_BODY = `<p>Здравствуйте!</p>
<p>Оплата по заказу {{orderid}} получена. Доступ к курсу «{{courseTitle}}» открыт.</p>
<p>Войдите в личный кабинет с тем же email, что указали при оплате: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
<p>После входа перейдите в раздел «Мои курсы».</p>
<p>Если у вас ещё нет аккаунта — зарегистрируйтесь с этим email, и курс будет доступен.</p>
<p><a href="{{successUrl}}">Подробнее на странице результата оплаты</a>.</p>
<p>— {{portal_title}}</p>`;

const DEFAULT_PAYMENT_GENERIC_SUBJECT = 'Оплата получена';
const DEFAULT_PAYMENT_GENERIC_BODY = `<p>Здравствуйте!</p>
<p>Оплата по заказу {{orderid}} получена. Спасибо за оплату!</p>
<p>Мы свяжемся с вами в ближайшее время для согласования деталей.</p>
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

/** Подстановка переменных в шаблон письма об оплате. */
export function renderPaymentEmailTemplate(
  template: string,
  vars: { orderid: string; courseTitle?: string; loginUrl: string; successUrl: string; portal_title: string }
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
