/**
 * Постановка роликов в очередь Telegram-канала школы (T3.4/T3.5).
 *
 * Запуск:
 *   npx tsx scripts/social-enqueue.ts queue.json --dry   # показать подписи, ничего не писать
 *   npx tsx scripts/social-enqueue.ts queue.json         # записать в очередь
 *
 * Формат queue.json — массив:
 *   [{ "file": "2026-10-14-test.mp4", "title": "Почему дрожат руки",
 *      "body": "Короткий текст поста.", "ref": "tg-01", "scheduledAt": "2026-10-14 10:00" }]
 * scheduledAt без смещения — московское время. "hashtags" необязательно.
 *
 * Любое предупреждение проверок подписи (правила школы, «не» в заголовке, длина,
 * запрещённые формулировки) — причина не записывать: при нём скрипт завершается с кодом 1
 * и ничего не пишет. Файл на сервере не обязан существовать при постановке, но
 * если его нет в каталоге соцсетей, скрипт об этом предупреждает.
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/db';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '../lib/content/brand-kb';
import { resolveSocialMediaPath } from '../lib/social/media-path';
import { formatMsk } from '../lib/social/moscow-day';
import { parseQueueInput } from '../lib/social/queue-input';
import { buildTelegramCaption, SCHOOL_COURSE_URL } from '../lib/social/telegram-caption';
import { getMediaDir } from '../lib/social/scheduler';

/** Канал школы: @avaterrapro. Chat id фиксирован; сменить можно флагом --chat-id=… */
const SCHOOL_CHANNEL = { chatId: '-1003916704986', username: 'avaterrapro' };
const NETWORK_CODE = 'telegram';
const KB_PATH = path.join(process.cwd(), 'content', 'knowledge', 'avaterra.yaml');

function loadProhibitedPhrases(): string[] {
  return normalizeBrandFromKb(loadKbYamlFromPath(KB_PATH)).prohibitedPhrases;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const chatArg = args.find((a) => a.startsWith('--chat-id='));
  const chatId = chatArg ? chatArg.slice('--chat-id='.length).trim() : SCHOOL_CHANNEL.chatId;
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/social-enqueue.ts <queue.json> [--dry] [--chat-id=-100…]');
    return 2;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Не читается JSON «${file}»: ${(e as Error).message}`);
    return 1;
  }

  const mediaDir = await getMediaDir();
  const { entries, errors } = parseQueueInput(raw, { mediaDir });
  const problems: string[] = [...errors];
  const prohibited = loadProhibitedPhrases();

  const built = entries.map((e) => ({
    entry: e,
    ...buildTelegramCaption({
      title: e.title,
      body: e.body,
      refCode: e.ref,
      hashtags: e.hashtags,
      prohibitedPhrases: prohibited,
    }),
  }));

  if (entries.length > 0) {
    const taken = await prisma.socialPost.findMany({
      where: { networkCode: NETWORK_CODE, refCode: { in: entries.map((e) => e.ref) } },
      select: { refCode: true },
    });
    for (const t of taken) problems.push(`метка ${t.refCode} уже есть в очереди Telegram`);
  }

  for (const b of built) {
    const { entry } = b;
    console.log(`\n=== ${entry.ref} · ${formatMsk(entry.scheduledAt)} · ${entry.file}`);
    console.log(b.caption);
    for (const w of b.warnings) problems.push(`${entry.ref}: ${w}`);
    if (!fs.existsSync(resolveSocialMediaPath(entry.file, mediaDir))) {
      console.log(`Внимание: файла «${entry.file}» нет в ${mediaDir} (до публикации он должен лежать там).`);
    }
  }

  const network = await prisma.socialNetwork.findUnique({ where: { code: NETWORK_CODE } });
  if (network && !network.enabled) {
    console.log('\nВнимание: сеть telegram выключена (enabled=false). Посты встанут в очередь, пока её не включат.');
  }

  if (problems.length > 0) {
    console.error('\nОчередь НЕ записана. Проверки:');
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  if (dry) {
    console.log(`\n--dry: записей ${built.length}, ничего не записано.`);
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    await tx.socialNetwork.upsert({
      where: { code: NETWORK_CODE },
      // enabled в update не трогаем: выключенную владельцем или по ошибкам сеть enqueue не включает.
      create: {
        code: NETWORK_CODE,
        title: 'Telegram-канал школы',
        enabled: true,
        mode: 'auto',
        profileUrl: `https://t.me/${SCHOOL_CHANNEL.username}`,
        chatId,
      },
      update: { title: 'Telegram-канал школы', mode: 'auto', profileUrl: `https://t.me/${SCHOOL_CHANNEL.username}`, chatId },
    });
    for (const b of built) {
      const item = await tx.socialItem.create({
        data: {
          kind: 'video',
          title: b.entry.title,
          body: b.entry.body || null,
          mediaPath: b.entry.file,
          sourceUrl: SCHOOL_COURSE_URL,
          status: 'ready',
        },
      });
      await tx.socialPost.create({
        data: {
          itemId: item.id,
          networkCode: NETWORK_CODE,
          caption: b.caption,
          refCode: b.entry.ref,
          status: 'scheduled',
          scheduledAt: b.entry.scheduledAt,
        },
      });
    }
  });
  console.log(`\nЗаписано в очередь: ${built.length}.`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
