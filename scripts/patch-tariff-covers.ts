/**
 * Обновляет imageUrl у трёх тарифов AVATERRA (витрина / #pricing).
 * Запуск: npx tsx scripts/patch-tariff-covers.ts
 */
import { prisma } from '../lib/db';

const PATCHES: [string, string][] = [
  ['kod-tela-start', '/images/tariffs/kod-tela-start-cover.png'],
  ['avaterra-praktik', '/images/tariffs/avaterra-praktik-cover.png'],
  ['avaterra-master-vip', '/images/tariffs/avaterra-master-vip-cover.png'],
];

async function main() {
  for (const [slug, imageUrl] of PATCHES) {
    const r = await prisma.service.updateMany({ where: { slug }, data: { imageUrl } });
    console.log(slug, r.count ? 'ok' : 'skip (нет записи)');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
