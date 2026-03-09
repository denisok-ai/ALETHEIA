/**
 * Email helpers: Resend wrapper and template rendering.
 */
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM || 'onboarding@resend.dev';

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
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
