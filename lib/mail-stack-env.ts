/**
 * Параметры автономного почтового стека (IMAP/SMTP для InboundMailbox, переменные для провижининга Mailcow).
 * Читаются из process.env на сервере — см. docs/Mail-Server.md и .env.example.
 */

export type MailProvisioningMode = 'mailcow' | 'none';

export function getMailProvisioningMode(): MailProvisioningMode {
  const m = (process.env.MAIL_PROVISIONING_MODE ?? 'none').trim().toLowerCase();
  return m === 'mailcow' ? 'mailcow' : 'none';
}

/** Хост IMAP для записей InboundMailbox (напр. mail.avaterra.pro). */
export function getMailImapHost(): string {
  return process.env.MAIL_IMAP_HOST?.trim() || 'mail.avaterra.pro';
}

export function getMailImapPort(): number {
  const n = parseInt(process.env.MAIL_IMAP_PORT ?? '993', 10);
  return Number.isFinite(n) && n > 0 ? n : 993;
}

/** Хост SMTP submission для ответов из админки. */
export function getMailSmtpHost(): string {
  return process.env.MAIL_SMTP_HOST?.trim() || getMailImapHost();
}

export function getMailSmtpPort(): number {
  const n = parseInt(process.env.MAIL_SMTP_PORT ?? '587', 10);
  return Number.isFinite(n) && n > 0 ? n : 587;
}

/** Основной домен почты (локальная часть ящика + домен). */
export function getMailDomain(): string {
  return process.env.MAIL_DOMAIN?.trim() || 'avaterra.pro';
}

export function getMailcowApiUrl(): string | null {
  const u = process.env.MAILCOW_API_URL?.trim();
  return u || null;
}

export function getMailcowApiKey(): string | null {
  const k = process.env.MAILCOW_API_KEY?.trim();
  return k || null;
}

/**
 * Проверка TLS-сертификата при IMAP/SMTP к почтовому серверу (imapflow / nodemailer).
 * По умолчанию `true` (строго). Для Mailcow с внутренним/snakeoil-сертификатом (`SKIP_LETS_ENCRYPT=y`)
 * на том же VPS задайте в `.env`: `MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=false`.
 */
export function mailImapTlsRejectUnauthorized(): boolean {
  const v = process.env.MAIL_IMAP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

/**
 * Принудительно брать SMTP для транзакционной почты из `MAIL_SMTP_*` в `.env`,
 * даже если в БД (админка) остались старые host/user или Resend.
 */
export function mailUseOwnSmtpFromEnv(): boolean {
  const v = process.env.MAIL_USE_OWN_SMTP?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
