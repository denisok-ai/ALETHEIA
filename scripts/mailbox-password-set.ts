/**
 * Смена пароля ящика через БД (обновляет шифр passwordEnc в DomainMailbox и InboundMailbox).
 *
 * Варианты:
 *   A) Полная логика как в админке — Mailcow API + БД (режим mailcow):
 *        MAILBOX_NEW_PASSWORD='...' npx tsx scripts/mailbox-password-set.ts --email admin@avaterra.pro
 *   B) Только БД — если пароль на Dovecot/Mailcow уже выставлен вручную:
 *        MAILBOX_NEW_PASSWORD='...' npx tsx scripts/mailbox-password-set.ts --email admin@avaterra.pro --db-only
 *
 * На VPS из каталога приложения (где есть .env с DATABASE_URL и NEXTAUTH_SECRET):
 *   cd /opt/ALETHEIA && MAILBOX_NEW_PASSWORD='...' npx tsx scripts/mailbox-password-set.ts --email admin@avaterra.pro --db-only
 *
 * Пароль берётся из переменной MAILBOX_NEW_PASSWORD (рекомендуется), либо из аргумента --password (осторожно: попадает в history shell).
 */
import { prisma } from '../lib/db';
import { encrypt } from '../lib/encrypt';

function parseArgs(): {
  email: string | null;
  password: string | null;
  dbOnly: boolean;
  dryRun: boolean;
} {
  const argv = process.argv.slice(2);
  let email: string | null = null;
  let password: string | null = process.env.MAILBOX_NEW_PASSWORD?.trim() || null;
  let dbOnly = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i + 1]) {
      email = argv[++i]!.trim().toLowerCase();
    } else if (a === '--password' && argv[i + 1]) {
      password = argv[++i]!;
    } else if (a === '--db-only') {
      dbOnly = true;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--help' || a === '-h') {
      console.log(`Использование:
  MAILBOX_NEW_PASSWORD='пароль' npx tsx scripts/mailbox-password-set.ts --email user@domain [--db-only] [--dry-run]

  --db-only   только запись зашифрованного пароля в БД (без Mailcow API)
  --dry-run   показать найденные записи, без изменений`);
      process.exit(0);
    }
  }
  return { email, password, dbOnly, dryRun };
}

async function setPasswordDbOnly(emailNorm: string, plain: string): Promise<{ ok: boolean; error?: string }> {
  const passwordEnc = encrypt(plain);

  const dm = await prisma.domainMailbox.findUnique({
    where: { email: emailNorm },
    select: { id: true, inboundMailboxId: true },
  });

  if (dm) {
    if (dm.inboundMailboxId) {
      await prisma.$transaction([
        prisma.domainMailbox.update({
          where: { id: dm.id },
          data: { passwordEnc },
        }),
        prisma.inboundMailbox.update({
          where: { id: dm.inboundMailboxId },
          data: { passwordEnc },
        }),
      ]);
    } else {
      await prisma.domainMailbox.update({
        where: { id: dm.id },
        data: { passwordEnc },
      });
    }
    return { ok: true };
  }

  const inbound = await prisma.inboundMailbox.findFirst({
    where: { username: emailNorm },
    select: { id: true },
  });
  if (!inbound) {
    return { ok: false, error: `Не найден ящик ${emailNorm} (ни DomainMailbox, ни InboundMailbox)` };
  }

  await prisma.inboundMailbox.update({
    where: { id: inbound.id },
    data: { passwordEnc },
  });
  return { ok: true };
}

async function main() {
  const { email, password, dbOnly, dryRun } = parseArgs();
  if (!email) {
    console.error('Укажите --email user@domain');
    process.exit(1);
  }

  if (dryRun) {
    const dm = await prisma.domainMailbox.findUnique({
      where: { email },
      select: { id: true, inboundMailboxId: true, email: true },
    });
    const ib = await prisma.inboundMailbox.findFirst({
      where: { username: email },
      select: { id: true, username: true },
    });
    console.log('[dry-run] DomainMailbox:', dm ?? '(нет)');
    console.log('[dry-run] InboundMailbox:', ib ?? '(нет)');
    return;
  }

  if (!password || password.length < 8) {
    console.error('Задайте пароль (минимум 8 символов): переменная MAILBOX_NEW_PASSWORD или --password');
    process.exit(1);
  }

  if (dbOnly) {
    const r = await setPasswordDbOnly(email, password);
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    }
    console.log(`OK — пароль записан в БД (шифр AES-GCM) для ${email}`);
    return;
  }

  const dm = await prisma.domainMailbox.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!dm) {
    console.error(
      'Нет строки DomainMailbox для этого email. Используйте --db-only для правки только InboundMailbox или создайте ящик в админке.'
    );
    process.exit(1);
  }

  const { changeDomainMailboxPassword } = await import('../lib/domain-mailbox-service');
  const result = await changeDomainMailboxPassword({
    domainMailboxId: dm.id,
    newPassword: password,
  });
  if (!result.ok) {
    console.error(result.error ?? 'Ошибка смены пароля');
    process.exit(1);
  }
  console.log(`OK — пароль обновлён (Mailcow при режиме mailcow + БД) для ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
