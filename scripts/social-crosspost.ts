/**
 * Кросспостинг очереди: те же материалы из одной сети — в другую (обычно Telegram → MAX).
 *
 * Запуск:
 *   npx tsx --env-file=.env scripts/social-crosspost.ts --dry            # показать, что встанет в очередь MAX
 *   npx tsx --env-file=.env scripts/social-crosspost.ts                  # записать
 *   npx tsx --env-file=.env scripts/social-crosspost.ts --from=telegram --to=max
 *
 * Берём посты исходной сети в статусе scheduled, у материала которых ещё нет поста в целевой сети.
 * Время то же; метка — тот же номер с префиксом целевой сети (tg-03 → mx-03); подпись собирается
 * заново под целевую сеть с проверками правил школы. Любое предупреждение — ничего не пишем.
 *
 * Целевые сети «готового поста» (--to=vk|dzen|rutube|youtube): подпись плоская (buildPlainCaption),
 * chat id не нужен. Сеть должна существовать с mode=ready_post; --create-network создаёт её
 * (upsert { code, title, mode: 'ready_post', enabled: true }). Для auto-сетей подключение обязательно.
 *   npx tsx --env-file=.env scripts/social-crosspost.ts --from=telegram --to=vk --create-network --dry
 */
import path from 'node:path';
import { prisma } from '../lib/db';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '../lib/content/brand-kb';
import { buildPlainCaption, READY_POST_NETWORKS, type ReadyPostNetwork } from '../lib/social/captions';
import { formatMsk } from '../lib/social/moscow-day';
import { checkQueuedPost } from '../lib/social/post-checks';
import { isValidRefCode, NETWORK_TO_REF_PREFIX } from '../lib/social/refs';
import { buildTelegramCaption, SCHOOL_COURSE_URL } from '../lib/social/telegram-caption';

const KB_PATH = path.join(process.cwd(), 'content', 'knowledge', 'avaterra.yaml');
const SUPPORTED = new Set(['telegram', 'max']);
const READY_POST = new Set<string>(READY_POST_NETWORKS);
/** Названия готовых сетей для создания строки SocialNetwork. */
const READY_POST_TITLES: Readonly<Record<ReadyPostNetwork, string>> = {
  vk: 'ВКонтакте (школа)',
  dzen: 'Яндекс Дзен',
  rutube: 'Rutube',
  youtube: 'YouTube Shorts',
};

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || fallback;
}

async function main(): Promise<number> {
  const dry = process.argv.includes('--dry');
  const createNetwork = process.argv.includes('--create-network');
  const from = arg('from', 'telegram');
  const to = arg('to', 'max');
  if (!SUPPORTED.has(from) || (!SUPPORTED.has(to) && !READY_POST.has(to)) || from === to) {
    console.error('--from: telegram или max; --to: telegram, max, vk, dzen, rutube, youtube. Источник и цель разные.');
    return 2;
  }
  const isReady = READY_POST.has(to);
  let target = await prisma.socialNetwork.findUnique({ where: { code: to } });
  if (isReady) {
    if (!target && createNetwork) {
      const title = READY_POST_TITLES[to as ReadyPostNetwork];
      if (dry) {
        console.log(`--dry: сеть ${to} будет создана (mode=ready_post, enabled=true).`);
      } else {
        target = await prisma.socialNetwork.upsert({
          where: { code: to },
          update: {},
          create: { code: to, title, mode: 'ready_post', enabled: true },
        });
        console.log(`Создана сеть ${to} (mode=ready_post).`);
      }
    } else if (!target) {
      console.error(`Сеть ${to} не заведена. Добавьте --create-network (строка SocialNetwork с mode=ready_post).`);
      return 1;
    } else if (target.mode !== 'ready_post') {
      console.error(`Сеть ${to} работает в режиме «${target.mode}», а не ready_post. Кросспостинг сюда через подпись готового поста не делаем.`);
      return 1;
    }
  } else if (!target?.chatId) {
    console.error(`Сеть ${to} не подключена (нет chat id). Для MAX: scripts/max-connect.ts.`);
    return 1;
  }

  const brand = normalizeBrandFromKb(loadKbYamlFromPath(KB_PATH));
  const source = await prisma.socialPost.findMany({
    where: { networkCode: from, status: 'scheduled', item: { posts: { none: { networkCode: to } } } },
    include: { item: true },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
  });
  if (source.length === 0) {
    console.log(`Нечего переносить: все запланированные посты ${from} уже есть в ${to}.`);
    return 0;
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  const planned = source.map((p) => {
    const num = p.refCode && isValidRefCode(p.refCode) ? p.refCode.slice(3) : String(p.itemId).padStart(2, '0');
    const refCode = `${NETWORK_TO_REF_PREFIX[to]}-${num}`;
    // Подпись для записи; её предупреждения входят в checkQueuedPost (тип поста у источника не хранится,
    // поэтому окно длины и CTA здесь не проверяются).
    const built = isReady
      ? buildPlainCaption({
          networkCode: to as ReadyPostNetwork,
          title: p.item.title,
          body: p.item.body ?? undefined,
          url: p.item.sourceUrl ?? SCHOOL_COURSE_URL,
          refCode,
          prohibitedPhrases: brand.prohibitedPhrases,
          hasMedia: Boolean(p.item.mediaPath),
        })
      : buildTelegramCaption({
          networkCode: to as 'telegram' | 'max',
          title: p.item.title,
          body: p.item.body ?? undefined,
          refCode,
          url: p.item.sourceUrl ?? undefined,
          prohibitedPhrases: brand.prohibitedPhrases,
        });
    const check = checkQueuedPost({
      networkCode: to,
      title: p.item.title,
      body: p.item.body ?? undefined,
      hasMedia: Boolean(p.item.mediaPath),
      refCode,
      url: p.item.sourceUrl ?? undefined,
      brand,
    });
    for (const x of check.problems) problems.push(`${refCode}: ${x}`);
    for (const x of check.warnings) warnings.push(`${refCode}: ${x}`);
    console.log(`\n=== ${refCode} · ${p.scheduledAt ? formatMsk(p.scheduledAt) : 'без времени'} · ${p.item.mediaPath ?? 'текст'}`);
    console.log(built.caption);
    return { itemId: p.itemId, scheduledAt: p.scheduledAt, refCode, caption: built.caption };
  });

  const taken = await prisma.socialPost.findMany({
    where: { networkCode: to, refCode: { in: planned.map((x) => x.refCode) } },
    select: { refCode: true },
  });
  for (const t of taken) problems.push(`метка ${t.refCode} уже занята в ${to}`);

  for (const w of warnings) console.log(`Предупреждение: ${w}`);
  if (problems.length > 0) {
    console.error('\nНичего не записано. Проверки:');
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  if (dry) {
    console.log(`\n--dry: в ${to} встанет ${planned.length}, ничего не записано.`);
    return 0;
  }
  await prisma.$transaction(
    planned.map((x) =>
      prisma.socialPost.create({
        data: {
          itemId: x.itemId,
          networkCode: to,
          caption: x.caption,
          refCode: x.refCode,
          status: 'scheduled',
          scheduledAt: x.scheduledAt,
        },
      }),
    ),
  );
  console.log(`\nЗаписано в очередь ${to}: ${planned.length}.${target?.enabled ? '' :` Внимание: сеть ${to} выключена.`}`);
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
