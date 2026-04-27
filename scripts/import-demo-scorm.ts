/**
 * Импорт SCORM-пакета в курс course-demo-muscle-testing («Пробный 12345», открыт всем в ЛК).
 * Использование:
 *   npm run scorm:import-demo
 *   npx tsx scripts/import-demo-scorm.ts "C:\\path\\to\\package.zip"
 * Переменная окружения SCORM_DEMO_ZIP_PATH переопределяет путь к архиву.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { installScormZip } from '../lib/scorm/install-scorm-zip';

export const DEMO_SCORM_COURSE_ID = 'course-demo-muscle-testing';
const DEMO_SCORM_COURSE_TITLE = 'Пробный 12345';

const DEFAULT_ZIP = path.join(
  process.cwd(),
  'docs',
  'scorm',
  'навыки_мышечного_тестирования_demo_scorm2004_2.zip'
);

async function main() {
  const fromArg = process.argv[2]?.trim();
  const zipPath =
    process.env.SCORM_DEMO_ZIP_PATH?.trim() ||
    (fromArg && existsSync(fromArg) ? fromArg : DEFAULT_ZIP);

  if (!existsSync(zipPath)) {
    console.error(
      `Файл не найден: ${zipPath}\n` +
        `Положите архив в docs/scorm/навыки_мышечного_тестирования_demo_scorm2004_2.zip или укажите путь аргументом / SCORM_DEMO_ZIP_PATH.`
    );
    process.exit(1);
  }

  await prisma.course.upsert({
    where: { id: DEMO_SCORM_COURSE_ID },
    create: {
      id: DEMO_SCORM_COURSE_ID,
      title: DEMO_SCORM_COURSE_TITLE,
      description:
        'Пробный курс в формате SCORM 2004. Материалы открываются во встроенном плеере личного кабинета.',
      status: 'published',
      openAccessForAllStudents: true,
      sortOrder: 1,
      courseFormat: 'scorm',
      price: null,
      aiTutorEnabled: true,
    },
    update: {
      title: DEMO_SCORM_COURSE_TITLE,
      status: 'published',
      openAccessForAllStudents: true,
      courseFormat: 'scorm',
    },
  });

  const buf = readFileSync(zipPath);
  const result = await installScormZip({
    courseId: DEMO_SCORM_COURSE_ID,
    buffer: buf,
    uploadedById: null,
    fileSize: buf.length,
  });

  console.log('SCORM установлен:', {
    courseId: DEMO_SCORM_COURSE_ID,
    ...result,
    zipPath,
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
