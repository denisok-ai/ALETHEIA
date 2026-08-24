/**
 * Перевод старого SMM-бота (@AvaterraSMMBot) в режим «редирект в бота портала».
 *
 * Запуск (токен только через переменную окружения, в аргументы не попадает):
 *   SMM_BOT_TOKEN=... npx tsx scripts/setup-telegram-smm-redirect.ts
 *   SMM_BOT_TOKEN=... npx tsx scripts/setup-telegram-smm-redirect.ts --status
 *
 * Что делает: проверяет токен через getMe, сохраняет токен и новый секрет вебхука
 * в SystemSetting (зашифрованно), ставит вебхук на /api/portal/telegram/smm-redirect.
 * После установки вебхука long-polling старого бота перестаёт получать обновления.
 */
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { getSystemSettings } from '@/lib/settings';
import { telegramApiFetch } from '@/lib/telegram-fetch';
import {
  SMM_SETTING_CATEGORY,
  SMM_TOKEN_KEY,
  SMM_WEBHOOK_SECRET_KEY,
} from '@/lib/telegram-smm-redirect';

const EXPECTED_USERNAME = 'avaterrasmmbot';
const WEBHOOK_PATH = '/api/portal/telegram/smm-redirect';

async function api<T>(token: string, method: string, body?: unknown): Promise<T> {
  const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? 'unknown error'}`);
  return data.result as T;
}

async function upsertSecret(key: string, value: string): Promise<void> {
  const encrypted = encrypt(value);
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: encrypted, category: SMM_SETTING_CATEGORY },
    update: { value: encrypted, category: SMM_SETTING_CATEGORY },
  });
}

async function main() {
  const token = process.env.SMM_BOT_TOKEN?.trim();
  if (!token) {
    console.error('Нет SMM_BOT_TOKEN в окружении.');
    process.exit(1);
  }

  const me = await api<{ username?: string; id?: number }>(token, 'getMe');
  console.log(`Бот: @${me.username ?? '—'} (id ${me.id ?? '—'})`);
  if ((me.username ?? '').toLowerCase() !== EXPECTED_USERNAME) {
    console.error(`СТОП: ожидался @AvaterraSMMBot, токен принадлежит другому боту.`);
    process.exit(2);
  }

  if (process.argv.includes('--status')) {
    const info = await api<{
      url?: string;
      pending_update_count?: number;
      last_error_message?: string;
      last_error_date?: number;
    }>(token, 'getWebhookInfo');
    console.log(`URL: ${info.url || '(не задан)'}`);
    console.log(`Ожидает обновлений: ${info.pending_update_count ?? 0}`);
    console.log(
      `Последняя ошибка: ${info.last_error_message ?? 'нет'}${
        info.last_error_date
          ? ` (${new Date(info.last_error_date * 1000).toLocaleString('ru-RU')})`
          : ''
      }`
    );
    return;
  }

  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const webhookUrl = `${siteUrl}${WEBHOOK_PATH}`;
  const secret = randomBytes(24).toString('hex');

  // Сначала секреты в БД, потом вебхук: иначе Telegram успеет прислать
  // обновление на эндпоинт, который ещё не знает секрета, и вернёт 401.
  await upsertSecret(SMM_TOKEN_KEY, token);
  await upsertSecret(SMM_WEBHOOK_SECRET_KEY, secret);
  console.log('Токен и секрет сохранены в SystemSetting (зашифрованно).');

  await api(token, 'setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    drop_pending_updates: true,
    max_connections: 10,
  });
  console.log(`Вебхук установлен: ${webhookUrl}`);

  const info = await api<{ url?: string; pending_update_count?: number; last_error_message?: string }>(
    token,
    'getWebhookInfo'
  );
  console.log(`Проверка: url=${info.url || '—'}, ожидает=${info.pending_update_count ?? 0}, ошибка=${info.last_error_message ?? 'нет'}`);
  console.log('Long-polling старого бота с этого момента обновлений не получает.');
}

main()
  .catch((e) => {
    console.error('ОШИБКА:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
