/**
 * Запись зашифрованного SMTP-пароля транзакционной почты в SystemSetting (ключ smtp_password).
 * Тот же формат шифрования, что при сохранении через Портал → Настройки / PATCH settings.
 *
 * Использование:
 *   SMTP_NEW_PASSWORD='...' npx tsx scripts/smtp-system-password-set.ts
 *
 * Опционально обновить открытые поля SMTP в БД (если нужно без админки):
 *   SMTP_NEW_PASSWORD='...' npx tsx scripts/smtp-system-password-set.ts \
 *     --smtp-host mail.avaterra.pro --smtp-user admin@avaterra.pro --smtp-port 587
 *
 * После записи перезапустите приложение (PM2/systemd), чтобы сбросить кэш getEnvOverrides в памяти.
 */
import { prisma } from '../lib/db';
import { encrypt } from '../lib/encrypt';

function parseArgs(): {
  password: string | null;
  smtpHost: string | null;
  smtpUser: string | null;
  smtpPort: string | null;
  smtpSecure: string | null;
  dryRun: boolean;
} {
  const argv = process.argv.slice(2);
  let password: string | null = process.env.SMTP_NEW_PASSWORD?.trim() || null;
  let smtpHost: string | null = null;
  let smtpUser: string | null = null;
  let smtpPort: string | null = null;
  let smtpSecure: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--password' && argv[i + 1]) password = argv[++i]!;
    else if (a === '--smtp-host' && argv[i + 1]) smtpHost = argv[++i]!.trim();
    else if (a === '--smtp-user' && argv[i + 1]) smtpUser = argv[++i]!.trim().toLowerCase();
    else if (a === '--smtp-port' && argv[i + 1]) smtpPort = argv[++i]!.trim();
    else if (a === '--smtp-secure' && argv[i + 1]) smtpSecure = argv[++i]!.trim();
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Использование:
  SMTP_NEW_PASSWORD='пароль' npx tsx scripts/smtp-system-password-set.ts [--smtp-host H] [--smtp-user U] [--smtp-port 587] [--smtp-secure ''|true|false]

  --dry-run   показать текущие значения (без пароля), без записи`);
      process.exit(0);
    }
  }
  return { password, smtpHost, smtpUser, smtpPort, smtpSecure, dryRun };
}

async function main() {
  const { password, smtpHost, smtpUser, smtpPort, smtpSecure, dryRun } = parseArgs();

  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure', 'smtp_password', 'email_transport'],
      },
    },
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  if (dryRun) {
    console.log('[dry-run] email_transport:', byKey.email_transport ?? '(нет)');
    console.log('[dry-run] smtp_host:', byKey.smtp_host ?? '(нет)');
    console.log('[dry-run] smtp_port:', byKey.smtp_port ?? '(нет)');
    console.log('[dry-run] smtp_user:', byKey.smtp_user ?? '(нет)');
    console.log('[dry-run] smtp_secure:', byKey.smtp_secure ?? '(нет)');
    console.log(
      '[dry-run] smtp_password:',
      byKey.smtp_password ? `[encrypted, ${byKey.smtp_password.length} chars]` : '(нет)'
    );
    return;
  }

  if (!password || password.length < 1) {
    console.error('Задайте SMTP_NEW_PASSWORD или --password');
    process.exit(1);
  }

  const enc = encrypt(password);

  await prisma.systemSetting.upsert({
    where: { key: 'smtp_password' },
    create: { key: 'smtp_password', value: enc, category: 'env' },
    update: { value: enc },
  });

  const extras: { key: string; value: string }[] = [];
  if (smtpHost !== null) extras.push({ key: 'smtp_host', value: smtpHost });
  if (smtpUser !== null) extras.push({ key: 'smtp_user', value: smtpUser });
  if (smtpPort !== null) extras.push({ key: 'smtp_port', value: smtpPort });
  if (smtpSecure !== null) extras.push({ key: 'smtp_secure', value: smtpSecure });

  for (const { key, value } of extras) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, category: 'env' },
      update: { value },
    });
  }

  console.log('OK — smtp_password сохранён в SystemSetting (шифрование как в админке).');
  if (extras.length) console.log('Обновлены также:', extras.map((e) => e.key).join(', '));
  console.log('Перезапустите процесс приложения (pm2 restart aletheia), чтобы кэш настроек подхватил изменения.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
