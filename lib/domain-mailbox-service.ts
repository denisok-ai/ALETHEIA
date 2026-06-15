/**
 * Создание ящика @avaterra.pro: опционально Mailcow API + InboundMailbox + DomainMailbox.
 */
import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import {
  mailcowAddMailbox,
  mailcowDeleteMailbox,
  mailcowEditMailboxPassword,
} from '@/lib/mail-provisioning/mailcow';
import {
  mailcowPasswordApplyDelayMs,
  sleepMs,
  verifyImapCredentials,
} from '@/lib/mail-provisioning/verify-imap';
import {
  getMailDomain,
  getMailImapHost,
  getMailImapPort,
  getMailProvisioningMode,
  getMailSmtpHost,
  getMailSmtpPort,
} from '@/lib/mail-stack-env';

function sanitizeLocalPart(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9._+-]+$/.test(s) || s.length > 64) {
    throw new Error('Недопустимое имя ящика (латиница, цифры, . _ + -)');
  }
  return s;
}

export function generateMailboxPassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = randomBytes(18);
  let out = '';
  for (let i = 0; i < 18; i++) {
    out += alphabet[buf[i]! % alphabet.length];
  }
  return `${out}!x9`;
}

export type CreateDomainMailboxResult =
  | {
      ok: true;
      domainMailboxId: string;
      email: string;
      inboundMailboxId: string;
      plainPassword: string;
      mailcowSummary?: string;
      /** false — пароль в приложении есть, но Dovecot не принял вход (см. warning). */
      imapVerified?: boolean;
      warning?: string;
    }
  | { ok: false; error: string };

async function verifyDomainMailboxImap(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const check = await verifyImapCredentials({
    host: getMailImapHost(),
    port: getMailImapPort(),
    username: email,
    password,
    tls: true,
  });
  return check.ok ? { ok: true } : { ok: false, error: check.error };
}

async function alignMailcowPasswordAndVerifyImap(
  email: string,
  password: string
): Promise<{ ok: true; summary?: string } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const align = await mailcowEditMailboxPassword(email, password);
    if (!align.ok) {
      return {
        ok: false,
        error:
          align.error + (align.raw ? ` — ${JSON.stringify(align.raw).slice(0, 400)}` : ''),
      };
    }
    await sleepMs(mailcowPasswordApplyDelayMs());
    const imap = await verifyDomainMailboxImap(email, password);
    if (imap.ok) {
      return { ok: true, summary: align.summary };
    }
    if (attempt === 1) {
      return {
        ok: false,
        error: imap.error ?? '[NO] Authentication failed.',
      };
    }
  }
  return { ok: false, error: 'IMAP verify failed after password align' };
}

export async function createDomainMailbox(params: {
  localPart: string;
  label: string;
  domain?: string;
  password?: string;
  createdById: string;
}): Promise<CreateDomainMailboxResult> {
  const domain = (params.domain ?? getMailDomain()).trim().toLowerCase();
  let localPart: string;
  try {
    localPart = sanitizeLocalPart(params.localPart);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка имени ящика' };
  }

  const email = `${localPart}@${domain}`.toLowerCase();
  const existing = await prisma.domainMailbox.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: 'Ящик с таким адресом уже существует' };
  }

  const password = params.password?.trim() || generateMailboxPassword();
  if (password.length < 8) {
    return { ok: false, error: 'Пароль слишком короткий (минимум 8 символов)' };
  }

  const mode = getMailProvisioningMode();
  let provisioningRef: string | undefined;
  let mailcowSummary: string | undefined;

  if (mode === 'mailcow') {
    const mc = await mailcowAddMailbox({
      localPart,
      domain,
      password,
      name: params.label.trim() || localPart,
    });
    if (!mc.ok) {
      return { ok: false, error: mc.error + (mc.raw ? ` — ${JSON.stringify(mc.raw).slice(0, 400)}` : '') };
    }
    /** Повторная запись пароля + проверка IMAP (см. docs/Mail-Server.md, scripts/prod-mailcow-align-password-remote.sh). */
    const aligned = await alignMailcowPasswordAndVerifyImap(email, password);
    if (!aligned.ok) {
      await mailcowDeleteMailbox(email).catch(() => {});
      return {
        ok: false,
        error: `${aligned.error} (ящик в Mailcow удалён, повторите создание)`,
      };
    }
    provisioningRef =
      [mc.summary, aligned.summary].filter(Boolean).join(' | ') || JSON.stringify(mc.raw).slice(0, 500);
    mailcowSummary = provisioningRef;
  }

  const passwordEnc = encrypt(password);

  try {
    const inbound = await prisma.inboundMailbox.create({
      data: {
        label: params.label.trim() || email,
        imapHost: getMailImapHost(),
        imapPort: getMailImapPort(),
        imapTls: true,
        username: email,
        passwordEnc,
        folder: 'INBOX',
        enabled: true,
        smtpHost: getMailSmtpHost(),
        smtpPort: getMailSmtpPort(),
        smtpTls: true,
      },
    });

    try {
      const dm = await prisma.domainMailbox.create({
        data: {
          email,
          localPart,
          domain,
          label: params.label.trim() || localPart,
          status: 'active',
          passwordEnc,
          provisioningKind: mode === 'mailcow' ? 'mailcow' : 'manual',
          provisioningRef: provisioningRef ?? null,
          inboundMailboxId: inbound.id,
          createdById: params.createdById,
        },
      });

      if (mode === 'mailcow') {
        return {
          ok: true,
          domainMailboxId: dm.id,
          email,
          inboundMailboxId: inbound.id,
          plainPassword: password,
          mailcowSummary,
          imapVerified: true,
        };
      }

      const imap = await verifyDomainMailboxImap(email, password);
      if (imap.ok) {
        return {
          ok: true,
          domainMailboxId: dm.id,
          email,
          inboundMailboxId: inbound.id,
          plainPassword: password,
          mailcowSummary,
          imapVerified: true,
        };
      }

      return {
        ok: true,
        domainMailboxId: dm.id,
        email,
        inboundMailboxId: inbound.id,
        plainPassword: password,
        mailcowSummary,
        imapVerified: false,
        warning:
          `IMAP-вход не подтверждён (${imap.error ?? 'Authentication failed'}). ` +
          'На сервере выполните: MAILBOX_EMAIL=' +
          email +
          ' bash scripts/prod-mailcow-create-domain-mailbox-remote.sh — ' +
          'или задайте MAIL_PROVISIONING_MODE=mailcow и MAILCOW_API_KEY (scripts/setup-mailcow-api-prod.sh).',
      };
    } catch (e) {
      await prisma.inboundMailbox.delete({ where: { id: inbound.id } }).catch(() => {});
      if (mode === 'mailcow') {
        await mailcowDeleteMailbox(email).catch(() => {});
      }
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Не удалось сохранить ящик в БД',
      };
    }
  } catch (e) {
    if (mode === 'mailcow') {
      await mailcowDeleteMailbox(email).catch(() => {});
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось сохранить связанную запись в БД',
    };
  }
}

/** Отключить ящик в приложении (IMAP-синк и ответы); запись в Mailcow не удаляется — удалите вручную в Mailcow при необходимости. */
export async function suspendDomainMailbox(domainMailboxId: string): Promise<{ ok: boolean; error?: string }> {
  const dm = await prisma.domainMailbox.findUnique({ where: { id: domainMailboxId } });
  if (!dm) return { ok: false, error: 'Не найдено' };

  await prisma.domainMailbox.update({
    where: { id: domainMailboxId },
    data: { status: 'suspended' },
  });

  if (dm.inboundMailboxId) {
    await prisma.inboundMailbox.update({
      where: { id: dm.inboundMailboxId },
      data: { enabled: false },
    });
  }

  return { ok: true };
}

/** Включить синхронизацию снова для приостановленного ящика. */
export async function resumeDomainMailbox(domainMailboxId: string): Promise<{ ok: boolean; error?: string }> {
  const dm = await prisma.domainMailbox.findUnique({ where: { id: domainMailboxId } });
  if (!dm) return { ok: false, error: 'Не найдено' };

  await prisma.domainMailbox.update({
    where: { id: domainMailboxId },
    data: { status: 'active' },
  });

  if (dm.inboundMailboxId) {
    await prisma.inboundMailbox.update({
      where: { id: dm.inboundMailboxId },
      data: { enabled: true },
    });
  }

  return { ok: true };
}

/**
 * Новый пароль для доменного ящика: Mailcow (если режим mailcow), шифрование в DomainMailbox и InboundMailbox.
 * В режиме **manual** пароль в Dovecot нужно выставить вручную в Mailcow тем же значением, иначе IMAP не совпадёт.
 */
export async function changeDomainMailboxPassword(params: {
  domainMailboxId: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const newPassword = params.newPassword.trim();
  if (newPassword.length < 8) {
    return { ok: false, error: 'Пароль слишком короткий (минимум 8 символов)' };
  }

  const dm = await prisma.domainMailbox.findUnique({
    where: { id: params.domainMailboxId },
  });
  if (!dm) return { ok: false, error: 'Не найдено' };

  const mode = getMailProvisioningMode();
  const oldEnc = dm.passwordEnc;
  const passwordEnc = encrypt(newPassword);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.domainMailbox.update({
        where: { id: dm.id },
        data: { passwordEnc },
      });
      if (dm.inboundMailboxId) {
        await tx.inboundMailbox.update({
          where: { id: dm.inboundMailboxId },
          data: { passwordEnc },
        });
      }
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось обновить пароль в базе',
    };
  }

  if (mode === 'mailcow') {
    const aligned = await alignMailcowPasswordAndVerifyImap(dm.email, newPassword);
    if (!aligned.ok) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.domainMailbox.update({
            where: { id: dm.id },
            data: { passwordEnc: oldEnc },
          });
          if (dm.inboundMailboxId) {
            await tx.inboundMailbox.update({
              where: { id: dm.inboundMailboxId },
              data: { passwordEnc: oldEnc },
            });
          }
        });
      } catch (revertErr) {
        console.error('[changeDomainMailboxPassword] DB revert after Mailcow failure failed', revertErr);
      }
      return { ok: false, error: aligned.error };
    }
  } else {
    const imap = await verifyDomainMailboxImap(dm.email, newPassword);
    if (!imap.ok) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.domainMailbox.update({
            where: { id: dm.id },
            data: { passwordEnc: oldEnc },
          });
          if (dm.inboundMailboxId) {
            await tx.inboundMailbox.update({
              where: { id: dm.inboundMailboxId },
              data: { passwordEnc: oldEnc },
            });
          }
        });
      } catch (revertErr) {
        console.error('[changeDomainMailboxPassword] DB revert after IMAP failure failed', revertErr);
      }
      return {
        ok: false,
        error:
          `IMAP не принял новый пароль (${imap.error ?? 'Authentication failed'}). ` +
          'Сначала выставьте тот же пароль в Mailcow или включите MAIL_PROVISIONING_MODE=mailcow.',
      };
    }
  }

  return { ok: true };
}

/** Удалить ящик из Mailcow (если режим mailcow) и записи в БД. Осторожно: необратимо на стороне почтового сервера. */
export async function deleteDomainMailbox(domainMailboxId: string): Promise<{ ok: boolean; error?: string }> {
  const dm = await prisma.domainMailbox.findUnique({
    where: { id: domainMailboxId },
  });
  if (!dm) return { ok: false, error: 'Не найдено' };

  const inboundId = dm.inboundMailboxId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.domainMailbox.delete({ where: { id: domainMailboxId } });
      if (inboundId) {
        await tx.inboundMailbox.delete({ where: { id: inboundId } });
      }
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось удалить запись из базы',
    };
  }

  const mode = getMailProvisioningMode();
  if (mode === 'mailcow') {
    const del = await mailcowDeleteMailbox(dm.email);
    if (!del.ok) {
      // Записи в БД уже удалены — не подменяем ok:true на false, иначе клиент решит, что удаления не было.
      console.error(
        '[deleteDomainMailbox] Mailcow delete failed after DB removal; remove mailbox manually in Mailcow:',
        dm.email,
        del.error
      );
    }
  }

  return { ok: true };
}
