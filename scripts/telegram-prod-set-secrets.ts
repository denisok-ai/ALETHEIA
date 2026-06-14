/**
 * Запись telegram_bot_token и telegram_webhook_secret в SystemSetting (AES-GCM).
 * На VPS: cd /opt/ALETHEIA && TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npx tsx scripts/telegram-prod-set-secrets.ts
 */
import { prisma } from '../lib/db';
import { encrypt } from '../lib/encrypt';
import { clearSettingsCache } from '../lib/settings';

const KEYS = [
  { key: 'telegram_bot_token', env: 'TELEGRAM_BOT_TOKEN', sensitive: true },
  { key: 'telegram_webhook_secret', env: 'TELEGRAM_WEBHOOK_SECRET', sensitive: true },
] as const;

async function upsertSetting(key: string, plain: string, category: string): Promise<void> {
  const value = encrypt(plain);
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value, category },
    update: { value, category },
  });
}

async function main() {
  for (const { key, env } of KEYS) {
    const plain = process.env[env]?.trim();
    if (!plain) {
      console.error(`Переменная ${env} не задана`);
      process.exit(1);
    }
    await upsertSetting(key, plain, 'env');
    console.log(`OK — ${key} записан (зашифрован, длина plaintext ${plain.length})`);
  }
  clearSettingsCache();
  console.log('OK — кэш настроек сброшен');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
