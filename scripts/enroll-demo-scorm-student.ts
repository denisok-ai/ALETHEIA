/**
 * Запись тестового студента на курс course-demo-muscle-testing (после scorm:import-demo).
 * npm run scorm:enroll-demo
 */
import { prisma } from '../lib/db';

const COURSE_ID = 'course-demo-muscle-testing';
const PREFERRED = process.env.ENROLL_EMAIL?.trim() || 'student1@test.local';
const FALLBACK = 'admin@test.local';

async function main() {
  let u = await prisma.user.findUnique({ where: { email: PREFERRED } });
  if (!u) {
    u = await prisma.user.findUnique({ where: { email: FALLBACK } });
  }
  if (!u) {
    console.error(
      `Нет пользователей ${PREFERRED} / ${FALLBACK}. Выполните: npm run db:seed`
    );
    process.exit(1);
  }
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: u.id, courseId: COURSE_ID } },
    create: { userId: u.id, courseId: COURSE_ID, accessClosed: false },
    update: { accessClosed: false },
  });
  console.log(`Запись создана: ${u.email} → ${COURSE_ID}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
