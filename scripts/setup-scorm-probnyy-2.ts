/**
 * Полная настройка курса «Пробный 2» из SCORM ZIP (аналог действий в админке):
 * курс, группа, лимит размера, установка SCORM, товар в витрине, записи на курс для активных пользователей.
 *
 *   npx tsx scripts/setup-scorm-probnyy-2.ts
 *   npx tsx scripts/setup-scorm-probnyy-2.ts "C:\\path\\to\\package.zip"
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/db';
import { installScormZip } from '../lib/scorm/install-scorm-zip';

const COURSE_ID = 'course-navyki-myshechnogo-import';
const TITLE = 'Пробный 2';
const DEFAULT_ZIP =
  process.env.SCORM_PROBNYY2_ZIP?.trim() ||
  'C:/Users/Lend1xx/Downloads/Scorm Навыки мышечного тестирования.zip';
const SERVICE_SLUG = 'probnyy-2-scorm';
const TARIFF_ID = 'probnyy-2-scorm';

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
  const zipPathArg = process.argv[2]?.trim();
  const resolved = path.resolve(
    zipPathArg && existsSync(path.resolve(zipPathArg)) ? zipPathArg : DEFAULT_ZIP
  );
  if (!existsSync(resolved)) {
    console.error('Архив не найден:', resolved);
    console.error('Укажите путь: npx tsx scripts/setup-scorm-probnyy-2.ts "C:\\\\path\\\\to.zip"');
    process.exit(1);
  }

  const maxSort = await prisma.course.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.course.upsert({
    where: { id: COURSE_ID },
    create: {
      id: COURSE_ID,
      title: TITLE,
      description:
        'Курс в формате SCORM. Материалы открываются во встроенном плеере личного кабинета.',
      status: 'published',
      sortOrder,
      courseFormat: 'scorm',
      price: null,
      aiTutorEnabled: true,
    },
    update: {
      title: TITLE,
      status: 'published',
      courseFormat: 'scorm',
    },
  });

  await ensureCourseGroupLink(COURSE_ID);

  const buf = readFileSync(resolved);
  const sizeMb = buf.length / (1024 * 1024);
  const row = await prisma.systemSetting.findUnique({ where: { key: 'scorm_max_size_mb' } });
  const currentMax = row?.value ? parseInt(row.value, 10) : 200;
  const needMb = Math.ceil(sizeMb + 5);
  if (!Number.isFinite(currentMax) || currentMax < needMb) {
    await prisma.systemSetting.upsert({
      where: { key: 'scorm_max_size_mb' },
      create: { key: 'scorm_max_size_mb', value: String(needMb), category: 'general' },
      update: { value: String(needMb) },
    });
    console.warn(`[setup] Лимит SCORM поднят до ${needMb} МБ (архив ~${sizeMb.toFixed(1)} МБ)`);
  }

  const installResult = await installScormZip({
    courseId: COURSE_ID,
    buffer: buf,
    uploadedById: null,
    fileSize: buf.length,
  });

  await prisma.service.upsert({
    where: { slug: SERVICE_SLUG },
    create: {
      slug: SERVICE_SLUG,
      name: 'Пробный 2 (SCORM)',
      description: 'Доступ к онлайн-курсу «Пробный 2» в личном кабинете.',
      price: 0,
      paykeeperTariffId: TARIFF_ID,
      courseId: COURSE_ID,
      isActive: true,
    },
    update: {
      name: 'Пробный 2 (SCORM)',
      courseId: COURSE_ID,
      paykeeperTariffId: TARIFF_ID,
      isActive: true,
    },
  });

  const learners = await prisma.user.findMany({
    where: {
      profile: {
        status: 'active',
        role: { in: ['user', 'admin'] },
      },
    },
    select: { id: true, email: true },
  });

  for (const u of learners) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: COURSE_ID } },
      create: { userId: u.id, courseId: COURSE_ID },
      update: { accessClosed: false },
    });
  }

  console.log('--- Готово ---');
  console.log({
    courseId: COURSE_ID,
    title: TITLE,
    zip: resolved,
    scorm: installResult,
    serviceSlug: SERVICE_SLUG,
    enrolledEmails: learners.map((x) => x.email),
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
