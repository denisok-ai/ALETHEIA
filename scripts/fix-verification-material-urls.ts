/**
 * Одноразово исправляет устаревшие videoUrl у видео-заявок на верификацию
 * (например /portal/manager/verifications#video-N), подставляя путь-заглушку.
 *
 * Запуск: npx tsx scripts/fix-verification-material-urls.ts
 * (или npm run db:fix-verification-urls)
 */
import { PrismaClient } from '@prisma/client';
import { isOpenableVideoMaterialUrl } from '../lib/verification-submission';

const prisma = new PrismaClient();

const FALLBACK_VIDEO_URL = '/uploads/verifications/seed-verification-placeholder.mp4';

async function main() {
  const rows = await prisma.phygitalVerification.findMany({
    where: { assignmentType: 'video' },
    select: { id: true, videoUrl: true },
  });

  let updated = 0;
  for (const r of rows) {
    if (isOpenableVideoMaterialUrl(r.videoUrl)) continue;
    await prisma.phygitalVerification.update({
      where: { id: r.id },
      data: { videoUrl: FALLBACK_VIDEO_URL },
    });
    updated++;
  }

  console.log(
    `Проверено видео-заявок: ${rows.length}. Обновлено URL (невалидные/заглушки портала): ${updated}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
