/**
 * Email helpers: Resend и/или SMTP (например Mail.ru), шаблоны.
 * Ключи API и SMTP: из БД (Портал → Настройки) или .env — см. getEnvOverrides, docs/Env-Config.md.
 */
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { mailImapTlsRejectUnauthorized, mailUseOwnSmtpFromEnv } from './mail-stack-env';
import { normalizeMailCred, normalizeMailboxUser } from './mail-creds';
import { getEnvOverrides } from './settings';
import { getSystemSettings } from './settings';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export type EmailTransportId = 'resend' | 'smtp';

export type SendEmailResult =
  | { ok: true; provider: EmailTransportId }
  | { ok: false; error: string; provider?: EmailTransportId | 'none' };

/**
 * Если в админке не задан SMTP, но на сервере заданы MAIL_SMTP_* (автономный mail-stack),
 * подставляем их для транзакционной почты — см. docs/Mail-Server.md.
 */
function mergeMailStackSmtpFromEnv(overrides: Record<string, string>): Record<string, string> {
  const out = { ...overrides };
  const host = normalizeMailCred(process.env.MAIL_SMTP_HOST);
  const user = normalizeMailboxUser(process.env.MAIL_SMTP_USER);
  const pass = normalizeMailCred(process.env.MAIL_SMTP_PASSWORD);
  const own = mailUseOwnSmtpFromEnv();

  if (!host || !user || !pass) return out;

  const portFromEnv = normalizeMailCred(process.env.MAIL_SMTP_PORT) || '587';
  const secureFromEnv = normalizeMailCred(process.env.MAIL_SMTP_SECURE);

  if (own || !out.smtp_host?.trim()) out.smtp_host = host;
  if (own || !out.smtp_port?.trim()) out.smtp_port = portFromEnv;
  if (own || !out.smtp_user?.trim()) out.smtp_user = user;
  if (own || !out.smtp_password?.trim()) out.smtp_password = pass;
  if (secureFromEnv && (own || !out.smtp_secure?.trim())) {
    out.smtp_secure = secureFromEnv;
  }

  if (own) {
    const et = process.env.EMAIL_TRANSPORT?.trim();
    if (et) out.email_transport = et;
    else if (!out.email_transport?.trim()) out.email_transport = 'smtp';
  }

  return out;
}

function pickTransport(overrides: Record<string, string>): 'resend' | 'smtp' | 'none' {
  const t = (overrides.email_transport || process.env.EMAIL_TRANSPORT || '').trim().toLowerCase();
  const hasResend = !!overrides.resend_api_key?.trim();
  const hasSmtp = !!(
    overrides.smtp_host?.trim() &&
    overrides.smtp_user?.trim() &&
    overrides.smtp_password?.trim()
  );
  const own = mailUseOwnSmtpFromEnv();

  if (t === 'smtp') return hasSmtp ? 'smtp' : 'none';
  if (t === 'resend') return hasResend ? 'resend' : 'none';
  if (own && hasSmtp) return 'smtp';
  if (hasResend) return 'resend';
  if (hasSmtp) return 'smtp';
  return 'none';
}

function parseSmtpPort(raw: string | undefined): number {
  const n = parseInt(String(raw || '465'), 10);
  if (!Number.isFinite(n) || n < 1) return 465;
  return n;
}

async function sendViaSmtp(
  overrides: Record<string, string>,
  to: string,
  subject: string,
  html: string,
  fromAddr: string,
  attachments?: EmailAttachment[]
): Promise<SendEmailResult> {
  const host = normalizeMailCred(overrides.smtp_host);
  const port = parseSmtpPort(overrides.smtp_port);
  const user = normalizeMailboxUser(overrides.smtp_user);
  const pass = normalizeMailCred(overrides.smtp_password);
  const secureExplicit = (overrides.smtp_secure || process.env.SMTP_SECURE || '').trim().toLowerCase();

  if (!host || !user || !pass) {
    return {
      ok: false,
      error: 'SMTP: не заданы хост, пользователь или пароль после нормализации.',
      provider: 'smtp',
    };
  }
  const secure =
    secureExplicit === 'true' || secureExplicit === '1'
      ? true
      : secureExplicit === 'false' || secureExplicit === '0'
        ? false
        : port === 465;

  const tlsStrict = mailImapTlsRejectUnauthorized();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(port === 587 && !secure ? { requireTLS: true } : {}),
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });

  try {
    await transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    return { ok: true, provider: 'smtp' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Ошибка SMTP',
      provider: 'smtp',
    };
  }
}

/** Детальный результат отправки (для журналов и диагностики). */
export async function sendEmailWithResult(
  to: string,
  subject: string,
  html: string,
  opts?: { from?: string; attachments?: EmailAttachment[] }
): Promise<SendEmailResult> {
  const overrides = mergeMailStackSmtpFromEnv(await getEnvOverrides());
  const mode = pickTransport(overrides);
  const settings = await getSystemSettings();
  const from = opts?.from || settings.resend_from || '';

  if (mode === 'none') {
    return {
      ok: false,
      error:
        'Нет транспорта почты: задайте RESEND_API_KEY или SMTP в настройках, либо MAIL_SMTP_* в окружении для автономной почты (docs/Env-Config.md, docs/Mail-Server.md).',
      provider: 'none',
    };
  }

  if (mode === 'smtp') {
    if (!from) {
      return {
        ok: false,
        error:
          'Для SMTP укажите отправителя: Настройки → Почта → Email отправителя (resend_from) или поле from в вызове.',
        provider: 'smtp',
      };
    }
    return sendViaSmtp(overrides, to, subject, html, from, opts?.attachments);
  }

  const apiKey = overrides.resend_api_key;
  if (!apiKey) {
    return { ok: false, error: 'Не настроен Resend API key', provider: 'none' };
  }
  const resend = new Resend(apiKey);
  const resendFrom = from || 'onboarding@resend.dev';
  try {
    const { error } = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
      attachments: opts?.attachments?.map((a) => ({ filename: a.filename, content: a.content })) ?? undefined,
    });
    if (error) {
      const msg =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message)
          : JSON.stringify(error);
      return { ok: false, error: msg || 'Resend error', provider: 'resend' };
    }
    return { ok: true, provider: 'resend' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Исключение при отправке',
      provider: 'resend',
    };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { from?: string; attachments?: EmailAttachment[] }
): Promise<boolean> {
  const r = await sendEmailWithResult(to, subject, html, opts);
  return r.ok;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return out;
}
