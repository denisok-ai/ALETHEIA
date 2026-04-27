/**
 * Удаляет все курсы. Снимает привязки Service / Group, удаляет папки public/uploads/scorm/courses-<id>/.
 *
 *   npx tsx scripts/delete-all-courses.ts --dry-run
 *   DELETE_COURSES_CONFIRM=YES npx tsx scripts/delete-all-courses.ts
 *   PowerShell: $env:DELETE_COURSES_CONFIRM="YES"; npx tsx scripts/delete-all-courses.ts
 */
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from '../lib/db';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.DELETE_COURSES_CONFIRM === 'YES';
  return { dryRun, confirm };
}

async function main() {
  const { dryRun, confirm } = parseArgs();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или DELETE_COURSES_CONFIRM=YES\n' +
        'PowerShell: $env:DELETE_COURSES_CONFIRM="YES"; npx tsx scripts/delete-all-courses.ts'
    );
    process.exit(1);
  }

  const victims = await prisma.course.findMany({
    select: { id: true, title: true },
  });

  console.log(`[delete-all-courses] к удалению: ${victims.length} шт.`);
  for (const v of victims.slice(0, 40)) {
    console.log(`  - ${v.id} — ${v.title}`);
  }
  if (victims.length > 40) console.log(`  … и ещё ${victims.length - 40}`);

  if (dryRun) process.exit(0);

  const ids = victims.map((v) => v.id);
  if (ids.length === 0) {
    console.log('Нечего удалять.');
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    await tx.group.updateMany({
      where: { sourceCourseId: { in: ids } },
      data: { sourceCourseId: null },
    });
    await tx.service.updateMany({
      where: { courseId: { in: ids } },
      data: { courseId: null },
    });
    await tx.course.deleteMany({ where: { id: { in: ids } } });
  });

  for (const id of ids) {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'scorm', `courses-${id}`);
    if (existsSync(dir)) {
      try {
        await rm(dir, { recursive: true, force: true });
        console.log(`[delete-all-courses] удалена папка: ${dir}`);
      } catch (e) {
        console.warn(`[delete-all-courses] не удалось удалить ${dir}:`, e);
      }
    }
  }

  console.log('[delete-all-courses] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
