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
    }
  | { ok: false; error: string };

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
    /** Повторная запись того же пароля через `edit/mailbox` синхронизирует хеш в Dovecot с БД приложения (как `scripts/prod-mailcow-align-password-remote.sh`). Без шага IMAP часто даёт `[NO] Authentication failed` сразу после `add/mailbox`. */
    const pwdAlign = await mailcowEditMailboxPassword(email, password);
    if (!pwdAlign.ok) {
      await mailcowDeleteMailbox(email).catch(() => {});
      return {
        ok: false,
        error:
          pwdAlign.error +
          (pwdAlign.raw ? ` — ${JSON.stringify(pwdAlign.raw).slice(0, 400)}` : '') +
          ' (ящик в Mailcow удалён, повторите создание)',
      };
    }
    provisioningRef =
      [mc.summary, pwdAlign.summary].filter(Boolean).join(' | ') || JSON.stringify(mc.raw).slice(0, 500);
    mailcowSummary = provisioningRef;
  }

  const passwordEnc = encrypt(password);

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

    return {
      ok: true,
      domainMailboxId: dm.id,
      email,
      inboundMailboxId: inbound.id,
      plainPassword: password,
      mailcowSummary,
    };
  } catch (e) {
    await prisma.inboundMailbox.delete({ where: { id: inbound.id } }).catch(() => {});
    if (mode === 'mailcow') {
      await mailcowDeleteMailbox(email);
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось сохранить ящик в БД',
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
  if (mode === 'mailcow') {
    const mc = await mailcowEditMailboxPassword(dm.email, newPassword);
    if (!mc.ok) {
      return {
        ok: false,
        error: mc.error + (mc.raw ? ` — ${JSON.stringify(mc.raw).slice(0, 400)}` : ''),
      };
    }
  }

  const passwordEnc = encrypt(newPassword);
  await prisma.domainMailbox.update({
    where: { id: dm.id },
    data: { passwordEnc },
  });

  if (dm.inboundMailboxId) {
    await prisma.inboundMailbox.update({
      where: { id: dm.inboundMailboxId },
      data: { passwordEnc },
    });
  }

  return { ok: true };
}

/** Удалить ящик из Mailcow (если режим mailcow) и записи в БД. Осторожно: необратимо на стороне почтового сервера. */
export async function deleteDomainMailbox(domainMailboxId: string): Promise<{ ok: boolean; error?: string }> {
  const dm = await prisma.domainMailbox.findUnique({
    where: { id: domainMailboxId },
  });
  if (!dm) return { ok: false, error: 'Не найдено' };

  const mode = getMailProvisioningMode();
  if (mode === 'mailcow') {
    const del = await mailcowDeleteMailbox(dm.email);
    if (!del.ok) {
      return { ok: false, error: del.error };
    }
  }

  await prisma.domainMailbox.delete({ where: { id: domainMailboxId } });
  if (dm.inboundMailboxId) {
    await prisma.inboundMailbox.delete({ where: { id: dm.inboundMailboxId } }).catch(() => {});
  }

  return { ok: true };
}
