/**
 * Полная очистка медиатеки: все записи Media (связи MediaGroup удаляются каскадом),
 * затем очистка public/uploads/media/ (локальные файлы превью и загрузок).
 *
 *   npx tsx scripts/clear-mediateka.ts --dry-run
 *   CLEAN_MEDIATEKA_CONFIRM=YES npx tsx scripts/clear-mediateka.ts
 */
import { rm, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from '../lib/db';

const MEDIA_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads', 'media');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.CLEAN_MEDIATEKA_CONFIRM === 'YES';

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или CLEAN_MEDIATEKA_CONFIRM=YES\n' +
        'PowerShell: $env:CLEAN_MEDIATEKA_CONFIRM="YES"; npx tsx scripts/clear-mediateka.ts'
    );
    process.exit(1);
  }

  const n = await prisma.media.count();
  console.log(`[clear-mediateka] записей Media в БД: ${n}`);
  console.log(`[clear-mediateka] папка загрузок: ${MEDIA_UPLOAD_ROOT}`);

  if (dryRun) process.exit(0);

  await prisma.media.deleteMany({});

  if (existsSync(MEDIA_UPLOAD_ROOT)) {
    await rm(MEDIA_UPLOAD_ROOT, { recursive: true, force: true });
  }
  await mkdir(MEDIA_UPLOAD_ROOT, { recursive: true });

  console.log('[clear-mediateka] Готово: БД очищена, каталог uploads/media пересоздан.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
