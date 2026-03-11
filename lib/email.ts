/**
 * Email helpers: Resend wrapper and template rendering.
 * API-ключ: из БД (настройки → Переменные окружения) или из process.env.RESEND_API_KEY.
 */
import { Resend } from 'resend';
import { getEnvOverrides } from './settings';
import { getSystemSettings } from './settings';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { from?: string; attachments?: EmailAttachment[] }
): Promise<boolean> {
  const overrides = await getEnvOverrides();
  const apiKey = overrides.resend_api_key || process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const resend = new Resend(apiKey);
  const settings = await getSystemSettings();
  const from = opts?.from || settings.resend_from || process.env.RESEND_FROM || 'onboarding@resend.dev';
  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      attachments: opts?.attachments?.map((a) => ({ filename: a.filename, content: a.content })) ?? undefined,
    });
    return !error;
  } catch {
    return false;
  }
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return out;
}
