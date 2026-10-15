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
 */
import path from 'node:path';
import { prisma } from '../lib/db';
import { loadKbYamlFromPath, normalizeBrandFromKb } from '../lib/content/brand-kb';
import { formatMsk } from '../lib/social/moscow-day';
import { isValidRefCode, NETWORK_TO_REF_PREFIX } from '../lib/social/refs';
import { buildTelegramCaption } from '../lib/social/telegram-caption';

const KB_PATH = path.join(process.cwd(), 'content', 'knowledge', 'avaterra.yaml');
const SUPPORTED = new Set(['telegram', 'max']);

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || fallback;
}

async function main(): Promise<number> {
  const dry = process.argv.includes('--dry');
  const from = arg('from', 'telegram');
  const to = arg('to', 'max');
  if (!SUPPORTED.has(from) || !SUPPORTED.has(to) || from === to) {
    console.error('--from/--to: telegram или max, разные.');
    return 2;
  }
  const target = await prisma.socialNetwork.findUnique({ where: { code: to } });
  if (!target?.chatId) {
    console.error(`Сеть ${to} не подключена (нет chat id). Для MAX: scripts/max-connect.ts.`);
    return 1;
  }

  const prohibited = normalizeBrandFromKb(loadKbYamlFromPath(KB_PATH)).prohibitedPhrases;
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
  const planned = source.map((p) => {
    const num = p.refCode && isValidRefCode(p.refCode) ? p.refCode.slice(3) : String(p.itemId).padStart(2, '0');
    const refCode = `${NETWORK_TO_REF_PREFIX[to]}-${num}`;
    const built = buildTelegramCaption({
      networkCode: to as 'telegram' | 'max',
      title: p.item.title,
      body: p.item.body ?? undefined,
      refCode,
      url: p.item.sourceUrl ?? undefined,
      prohibitedPhrases: prohibited,
    });
    for (const w of built.warnings) problems.push(`${refCode}: ${w}`);
    console.log(`\n=== ${refCode} · ${p.scheduledAt ? formatMsk(p.scheduledAt) : 'без времени'} · ${p.item.mediaPath ?? 'текст'}`);
    console.log(built.caption);
    return { itemId: p.itemId, scheduledAt: p.scheduledAt, refCode, caption: built.caption };
  });

  const taken = await prisma.socialPost.findMany({
    where: { networkCode: to, refCode: { in: planned.map((x) => x.refCode) } },
    select: { refCode: true },
  });
  for (const t of taken) problems.push(`метка ${t.refCode} уже занята в ${to}`);

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
  console.log(`\nЗаписано в очередь ${to}: ${planned.length}.${target.enabled ? '' : ` Внимание: сеть ${to} выключена.`}`);
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
