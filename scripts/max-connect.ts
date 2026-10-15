/**
 * Подключение канала школы в MAX к автопубликации.
 *
 * Запуск на сервере (обычно через scripts/max-connect.sh с машины владельца):
 *   echo -n "$TOKEN" | npx tsx --env-file=.env scripts/max-connect.ts [--wait=10] [--chat-id=…]
 *   npx tsx --env-file=.env scripts/max-connect.ts            # токен уже сохранён, только проверить канал
 *
 * Шаги:
 *  1. токен из stdin (если передан) → SystemSetting max_bot_token, зашифрован как из админки;
 *  2. GET /me — токен рабочий, имя бота;
 *  3. chat id канала: из --chat-id или из события bot_added (ждём до --wait минут —
 *     владелец в это время добавляет бота администратором канала);
 *  4. GET /chats/{id} и членство бота: админ ли, есть ли право write;
 *  5. SocialNetwork «max»: chat id, ссылка, mode=auto; enabled — только если бот может публиковать.
 * Токен не печатается.
 */
import { prisma } from '../lib/db';
import { encrypt } from '../lib/encrypt';
import { canPost, getChat, getMe, getMembership, getUpdates, MaxPublishError } from '../lib/social/connectors/max';

const NETWORK_CODE = 'max';
const NETWORK_TITLE = 'Канал школы в MAX';

async function readStdinToken(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

/** Ждём событие bot_added в канале; возвращаем chat id или null по истечении времени. */
async function waitForChannel(minutes: number): Promise<string | null> {
  const deadline = Date.now() + minutes * 60_000;
  let marker: number | null = null;
  console.log(`Жду, пока бота добавят администратором в канал (до ${minutes} мин)…`);
  while (Date.now() < deadline) {
    const left = Math.max(1, Math.min(30, Math.floor((deadline - Date.now()) / 1000)));
    const res = await getUpdates(['bot_added'], { marker, timeoutSec: left });
    marker = res.marker ?? marker;
    const added = res.updates.find((u) => u.update_type === 'bot_added' && u.chat_id != null);
    if (added) {
      console.log(`Событие bot_added: chat_id=${added.chat_id}${added.is_channel ? ' (канал)' : ' (групповой чат!)'}`);
      return String(added.chat_id);
    }
  }
  return null;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const waitMin = Number(args.find((a) => a.startsWith('--wait='))?.slice('--wait='.length) ?? '10');
  let chatId = args.find((a) => a.startsWith('--chat-id='))?.slice('--chat-id='.length).trim() ?? '';

  const token = await readStdinToken();
  if (token) {
    // Сначала проверяем, потом сохраняем: нерабочий токен в настройки не пишем.
    process.env.MAX_BOT_TOKEN = token;
  }

  const me = await getMe();
  console.log(`Токен рабочий: бот «${me.first_name ?? '—'}»${me.username ? ` (@${me.username})` : ''}, id ${me.user_id}.`);
  if (token) {
    await prisma.systemSetting.upsert({
      where: { key: 'max_bot_token' },
      create: { key: 'max_bot_token', value: encrypt(token), category: 'env' },
      update: { value: encrypt(token) },
    });
    console.log('Токен сохранён в настройках (зашифрован).');
  }

  if (!chatId) {
    const existing = await prisma.socialNetwork.findUnique({ where: { code: NETWORK_CODE } });
    chatId = existing?.chatId ?? '';
  }
  if (!chatId) {
    chatId = (await waitForChannel(Number.isFinite(waitMin) && waitMin > 0 ? waitMin : 10)) ?? '';
  }
  if (!chatId) {
    console.error('Канал не найден: бот не получил событие bot_added. Добавьте бота администратором канала и запустите снова.');
    return 1;
  }

  const chat = await getChat(chatId);
  const membership = await getMembership(chatId);
  const ok = canPost(membership);
  console.log(
    `Канал: «${chat.title ?? '—'}», тип ${chat.type ?? '—'}, ссылка ${chat.link ?? '—'}.\n` +
      `Бот: ${membership.is_admin ? 'администратор' : 'НЕ администратор'}, права: ${(membership.permissions ?? []).join(', ') || '—'}.`,
  );
  if (chat.type && chat.type !== 'channel') {
    console.error(`chat_id ${chatId} — это «${chat.type}», а не канал. Сеть не сохранена.`);
    return 1;
  }

  await prisma.socialNetwork.upsert({
    where: { code: NETWORK_CODE },
    create: {
      code: NETWORK_CODE,
      title: NETWORK_TITLE,
      enabled: ok,
      mode: 'auto',
      chatId,
      profileUrl: chat.link ?? null,
    },
    update: {
      title: NETWORK_TITLE,
      mode: 'auto',
      chatId,
      profileUrl: chat.link ?? null,
      // Включаем, только когда бот может публиковать; выключенную по ошибкам сеть это же и включает.
      ...(ok ? { enabled: true, failStreak: 0, lastError: null } : { enabled: false }),
    },
  });

  if (!ok) {
    console.error(
      'Сеть max сохранена ВЫКЛЮЧЕННОЙ: у бота нет права публиковать посты (write). ' +
        'В MAX: канал → Администраторы → бот → включить «Публиковать посты», затем запустить скрипт снова.',
    );
    return 1;
  }
  console.log('Готово: сеть max включена (mode=auto). Очередь: scripts/social-enqueue.ts --network=max или scripts/social-crosspost.ts.');
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error('Ошибка:', e instanceof MaxPublishError || e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
