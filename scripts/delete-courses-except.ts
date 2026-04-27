/**
 * Удаляет все курсы, кроме указанного (по умолчанию — основной SCORM course-demo-muscle-testing).
 * Снимает привязки Service / Group, удаляет папки public/uploads/scorm/courses-<id>/.
 *
 *   npx tsx scripts/delete-courses-except.ts --dry-run
 *   DELETE_COURSES_CONFIRM=YES npx tsx scripts/delete-courses-except.ts
 *   DELETE_COURSES_CONFIRM=YES npx tsx scripts/delete-courses-except.ts --keep other-course-id
 */
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from '../lib/db';

const DEFAULT_KEEP = 'course-demo-muscle-testing';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const keepIdx = process.argv.indexOf('--keep');
  const keepId = keepIdx >= 0 ? process.argv[keepIdx + 1]?.trim() : '';
  const confirm = process.env.DELETE_COURSES_CONFIRM === 'YES';
  return {
    dryRun,
    keepId: keepId || DEFAULT_KEEP,
    confirm,
  };
}

async function main() {
  const { dryRun, keepId, confirm } = parseArgs();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или DELETE_COURSES_CONFIRM=YES\n' +
        'PowerShell: $env:DELETE_COURSES_CONFIRM="YES"; npx tsx scripts/delete-courses-except.ts'
    );
    process.exit(1);
  }

  const victims = await prisma.course.findMany({
    where: { NOT: { id: keepId } },
    select: { id: true, title: true },
  });

  console.log(`[delete-courses-except] оставляем курс: ${keepId}`);
  console.log(`[delete-courses-except] к удалению: ${victims.length} шт.`);
  for (const v of victims.slice(0, 30)) {
    console.log(`  - ${v.id} — ${v.title}`);
  }
  if (victims.length > 30) console.log(`  … и ещё ${victims.length - 30}`);

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
        console.log(`[delete-courses-except] удалена папка: ${dir}`);
      } catch (e) {
        console.warn(`[delete-courses-except] не удалось удалить ${dir}:`, e);
      }
    }
  }

  console.log('[delete-courses-except] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
