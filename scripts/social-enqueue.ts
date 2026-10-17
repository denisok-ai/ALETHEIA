/**
 * Постановка роликов в очередь канала школы: Telegram (T3.4/T3.5) или MAX.
 *
 * Запуск:
 *   npx tsx scripts/social-enqueue.ts queue.json --dry   # показать подписи, ничего не писать
 *   npx tsx scripts/social-enqueue.ts queue.json         # записать в очередь Telegram
 *   npx tsx scripts/social-enqueue.ts queue-max.json --network=max   # очередь MAX (метки mx-01…)
 *
 * Канал MAX заводит scripts/max-connect.ts (токен, chat id, права бота) — до этого очередь MAX
 * не записывается: без chat id публиковать некуда.
 *
 * Формат queue.json — массив:
 *   [{ "file": "2026-10-14-test.mp4", "title": "Почему дрожат руки",
 *      "body": "Короткий текст поста.", "ref": "tg-01", "scheduledAt": "2026-10-14 10:00" }]
 * scheduledAt без смещения — московское время. "hashtags" необязательно.
 * "url" необязательно: ссылка подписи (https://avaterra.pro/…, без ?ref= — метка добавится сама).
 * Без "url" ведёт на страницу практикума.
 * Текстовый пост (без ролика): без "file", с "body" — это текст поста. Лимит текста
 * длиннее лимита подписи к видео (Telegram 4096, MAX 4000).
 *
 * Любое предупреждение проверок подписи (правила школы, «не» в заголовке, длина,
 * запрещённые формулировки) — причина не записывать: при нём скрипт завершается с кодом 1
 * и ничего не пишет. Файл на сервере не обязан существовать при постановке, но
 * если его нет в каталоге соцсетей, скрипт об этом предупреждает.
 *
 * Если ролик лежит локально, он проверяется ffprobe (lib/social/video-check.ts): превышение лимита сети,
 * нет видеопотока, длительность 0, для MAX — формат контейнера. Такие проблемы блокируют очередь;
 * предупреждения (вертикаль не 9:16, звук, кодек, длина) только печатаются.
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
import { checkVideo, probeVideo } from '../lib/social/video-check';

/** Telegram-канал школы: @avaterrapro. Chat id фиксирован; сменить можно флагом --chat-id=… */
const SCHOOL_CHANNEL = { chatId: '-1003916704986', username: 'avaterrapro' };
type NetworkCode = 'telegram' | 'max';
const KB_PATH = path.join(process.cwd(), 'content', 'knowledge', 'avaterra.yaml');

function loadProhibitedPhrases(): string[] {
  return normalizeBrandFromKb(loadKbYamlFromPath(KB_PATH)).prohibitedPhrases;
}

/**
 * Проверка ролика ffprobe (T3.7), если файл лежит локально. Проблемы — в общий список (очередь не пишется),
 * предупреждения только печатаются. Если ffprobe не удалось запустить, это тоже проблема:
 * не проверенный ролик в очередь не ставим.
 */
async function checkVideoFile(ref: string, absPath: string, network: NetworkCode, problems: string[]): Promise<void> {
  try {
    const meta = await probeVideo(absPath);
    const result = checkVideo(meta, { network });
    console.log(
      `Ролик: ${(meta.sizeBytes / 1048576).toFixed(1)} МБ, ${meta.durationSec.toFixed(1)} с, ` +
        `${meta.width}×${meta.height} (${result.profile}), видео ${meta.videoCodec ?? 'нет'}, звук ${meta.hasAudio ? 'есть' : 'нет'}`,
    );
    for (const p of result.problems) problems.push(`${ref}: ролик — ${p}`);
    for (const w of result.warnings) console.log(`Предупреждение ролика ${ref}: ${w}`);
  } catch (e) {
    problems.push(`${ref}: ролик не проверен — ${(e as Error).message}`);
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const networkArg = args.find((a) => a.startsWith('--network='))?.slice('--network='.length).trim() ?? 'telegram';
  if (networkArg !== 'telegram' && networkArg !== 'max') {
    console.error(`--network: telegram или max (передано «${networkArg}»)`);
    return 2;
  }
  const NETWORK_CODE: NetworkCode = networkArg;
  const chatArg = args.find((a) => a.startsWith('--chat-id='));
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Использование: npx tsx scripts/social-enqueue.ts <queue.json> [--dry] [--network=telegram|max] [--chat-id=…]');
    return 2;
  }

  const existing = await prisma.socialNetwork.findUnique({ where: { code: NETWORK_CODE } });
  let chatId: string;
  if (chatArg) chatId = chatArg.slice('--chat-id='.length).trim();
  else if (NETWORK_CODE === 'telegram') chatId = SCHOOL_CHANNEL.chatId;
  else chatId = existing?.chatId ?? '';
  if (!chatId) {
    console.error('Канал MAX не подключён: сначала scripts/max-connect.ts (он сохранит chat id канала).');
    return 1;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Не читается JSON «${file}»: ${(e as Error).message}`);
    return 1;
  }

  const mediaDir = await getMediaDir();
  const { entries, errors } = parseQueueInput(raw, { mediaDir, networkCode: NETWORK_CODE });
  const problems: string[] = [...errors];
  const prohibited = loadProhibitedPhrases();

  const built = entries.map((e) => ({
    entry: e,
    ...buildTelegramCaption({
      networkCode: NETWORK_CODE,
      title: e.title,
      body: e.body,
      refCode: e.ref,
      url: e.url,
      hashtags: e.hashtags,
      prohibitedPhrases: prohibited,
      hasMedia: e.file !== null,
    }),
  }));

  if (entries.length > 0) {
    const taken = await prisma.socialPost.findMany({
      where: { networkCode: NETWORK_CODE, refCode: { in: entries.map((e) => e.ref) } },
      select: { refCode: true },
    });
    for (const t of taken) problems.push(`метка ${t.refCode} уже есть в очереди ${NETWORK_CODE}`);
  }

  for (const b of built) {
    const { entry } = b;
    const material = entry.file ?? 'текстовый пост, без медиа';
    console.log(`\n=== ${entry.ref} · ${formatMsk(entry.scheduledAt)} · ${material}`);
    console.log(b.caption);
    for (const w of b.warnings) problems.push(`${entry.ref}: ${w}`);
    if (entry.file) {
      const abs = resolveSocialMediaPath(entry.file, mediaDir);
      if (fs.existsSync(abs)) {
        await checkVideoFile(entry.ref, abs, NETWORK_CODE, problems);
      } else {
        console.log(`Внимание: файла «${entry.file}» нет в ${mediaDir} (до публикации он должен лежать там).`);
      }
    }
  }

  if (existing && !existing.enabled) {
    console.log(`\nВнимание: сеть ${NETWORK_CODE} выключена (enabled=false). Посты встанут в очередь, пока её не включат.`);
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
    // Сеть MAX создаёт max-connect.ts (там же проверка прав бота); здесь только Telegram.
    if (NETWORK_CODE === 'telegram') {
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
    }
    for (const b of built) {
      const item = await tx.socialItem.create({
        data: {
          // Текстовый пост — kind 'news' без mediaPath: планировщик публикует его через publishText.
          kind: b.entry.file ? 'video' : 'news',
          title: b.entry.title,
          body: b.entry.body || null,
          mediaPath: b.entry.file,
          sourceUrl: b.entry.url ?? SCHOOL_COURSE_URL,
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
