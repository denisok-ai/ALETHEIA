/**
 * Удаляет курсы, не привязанные к товарам витрины (модель Service: courseId).
 * Снимает sourceCourseId у групп, обнуляет courseId у услуг (на всякий случай), удаляет SCORM-папки.
 *
 *   npx tsx scripts/delete-courses-not-in-services.ts --dry-run
 *   DELETE_COURSES_CONFIRM=YES npx tsx scripts/delete-courses-not-in-services.ts
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
        'bash: DELETE_COURSES_CONFIRM=YES npx tsx scripts/delete-courses-not-in-services.ts',
    );
    process.exit(1);
  }

  const linkedRows = await prisma.service.findMany({
    where: { courseId: { not: null } },
    select: { courseId: true, slug: true, name: true },
  });
  const linkedIds = [...new Set(linkedRows.map((r) => r.courseId!).filter(Boolean))];

  console.log(`[delete-courses-not-in-services] курсы из товаров (Service): ${linkedIds.length} шт.`);
  for (const row of linkedRows.slice(0, 20)) {
    console.log(`  service ${row.slug} → courseId=${row.courseId}`);
  }
  if (linkedRows.length > 20) console.log(`  … всего записей Service с courseId: ${linkedRows.length}`);

  const allCourses = await prisma.course.findMany({
    select: { id: true, title: true },
  });
  const linkedSet = new Set(linkedIds);
  const victims =
    linkedIds.length === 0
      ? allCourses
      : allCourses.filter((c) => !linkedSet.has(c.id));

  console.log(`[delete-courses-not-in-services] к удалению (нет в товарах): ${victims.length} шт.`);
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
        console.log(`[delete-courses-not-in-services] удалена папка: ${dir}`);
      } catch (e) {
        console.warn(`[delete-courses-not-in-services] не удалось удалить ${dir}:`, e);
      }
    }
  }

  console.log('[delete-courses-not-in-services] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
