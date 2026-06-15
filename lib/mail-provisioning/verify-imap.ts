/**
 * Проверка IMAP-аутентификации (Dovecot) после создания/смены пароля ящика.
 */
import { ImapFlow } from 'imapflow';

import { normalizeMailboxUser, normalizeMailCred } from '@/lib/mail-creds';
import { mailImapTlsRejectUnauthorized } from '@/lib/mail-stack-env';

export type VerifyImapResult = { ok: true } | { ok: false; error: string };

export async function verifyImapCredentials(params: {
  host: string;
  port: number;
  username: string;
  password: string;
  tls?: boolean;
}): Promise<VerifyImapResult> {
  const tlsStrict = mailImapTlsRejectUnauthorized();
  const client = new ImapFlow({
    host: params.host,
    port: params.port,
    secure: params.tls ?? true,
    auth: {
      user: normalizeMailboxUser(params.username),
      pass: normalizeMailCred(params.password),
    },
    logger: false,
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });

  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

/** Dovecot/Mailcow может применить пароль с задержкой после API edit/mailbox. */
export function mailcowPasswordApplyDelayMs(): number {
  return 2500;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
