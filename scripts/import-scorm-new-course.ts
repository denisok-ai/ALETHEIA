/**
 * Создаёт новый курс и загружает в него SCORM из ZIP (как загрузка в админке).
 *
 * Примеры:
 *   npx tsx scripts/import-scorm-new-course.ts "C:\path\package.zip"
 *   npx tsx scripts/import-scorm-new-course.ts "/mnt/c/Users/.../package.zip" --id=course-my-scorm --title="Мой курс"
 *   npx tsx scripts/import-scorm-new-course.ts course.zip --open
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { installScormZip } from '../lib/scorm/install-scorm-zip';

function parseArgs() {
  const rest = process.argv.slice(2);
  const positional: string[] = [];
  let courseId = 'course-navyki-myshechnogo-import';
  let title = 'Навыки мышечного тестирования';
  let openAccessForAllStudents = false;
  for (const a of rest) {
    if (a.startsWith('--id=')) courseId = a.slice(5).trim();
    else if (a.startsWith('--title=')) title = a.slice(8).trim();
    else if (a === '--open') openAccessForAllStudents = true;
    else if (a.length) positional.push(a);
  }
  const zipPath = positional[0]?.trim() ?? '';
  return { zipPath, courseId, title, openAccessForAllStudents };
}

async function ensureCourseGroupLink(courseId: string) {
  const courseGroup =
    (await prisma.group.findFirst({
      where: { moduleType: 'course', name: 'Курсы' },
    })) ??
    (await prisma.group.create({
      data: { name: 'Курсы', moduleType: 'course', displayOrder: 0 },
    }));

  await prisma.courseGroup.upsert({
    where: { courseId_groupId: { courseId, groupId: courseGroup.id } },
    create: { courseId, groupId: courseGroup.id },
    update: {},
  });
}

async function main() {
  const { zipPath, courseId, title, openAccessForAllStudents } = parseArgs();
  if (!zipPath) {
    console.error(
      'Укажите путь к ZIP первым аргументом.\n' +
        'Пример: npx tsx scripts/import-scorm-new-course.ts "C:\\\\Users\\\\Me\\\\course.zip"'
    );
    process.exit(1);
  }
  if (!/^course-[a-z0-9-]+$/i.test(courseId)) {
    console.error('ID курса: латиница, цифры, дефисы, с префиксом course- (например course-navyki-v1).');
    process.exit(1);
  }

  const resolved = path.resolve(zipPath);
  if (!existsSync(resolved)) {
    console.error(`Файл не найден: ${resolved}`);
    process.exit(1);
  }

  const maxSort = await prisma.course.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.course.upsert({
    where: { id: courseId },
    create: {
      id: courseId,
      title,
      description: 'Курс в формате SCORM. Материалы открываются во встроенном плеере личного кабинета.',
      status: 'published',
      sortOrder,
      courseFormat: 'scorm',
      price: null,
      aiTutorEnabled: true,
      openAccessForAllStudents,
    },
    update: {
      title,
      status: 'published',
      courseFormat: 'scorm',
      openAccessForAllStudents,
    },
  });

  await ensureCourseGroupLink(courseId);

  const buf = readFileSync(resolved);
  const sizeMb = buf.length / (1024 * 1024);
  const row = await prisma.systemSetting.findUnique({ where: { key: 'scorm_max_size_mb' } });
  const currentMax = row?.value ? parseInt(row.value, 10) : 200;
  const needMb = Math.ceil(sizeMb + 5);
  if (!Number.isFinite(currentMax) || currentMax < needMb) {
    await prisma.systemSetting.upsert({
      where: { key: 'scorm_max_size_mb' },
      create: {
        key: 'scorm_max_size_mb',
        value: String(needMb),
        category: 'general',
      },
      update: { value: String(needMb) },
    });
    console.warn(
      `[import] Лимит размера SCORM в настройках поднят до ${needMb} МБ (архив ~${sizeMb.toFixed(1)} МБ).`
    );
  }

  const result = await installScormZip({
    courseId,
    buffer: buf,
    uploadedById: null,
    fileSize: buf.length,
  });

  console.log('Готово. Новый курс создан и SCORM установлен:', {
    courseId,
    title,
    zipPath: resolved,
    ...result,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
