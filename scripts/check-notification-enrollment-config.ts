/**
 * Проверка наборов уведомлений для события enrollment (зачисление после оплаты).
 * Выводит курсы без привязки к активному набору с eventType=enrollment,
 * и список активных наборов enrollment с типом доставки шаблона.
 *
 *   npx tsx scripts/check-notification-enrollment-config.ts
 */
import { prisma } from '../lib/db';

async function main() {
  const publishedCourses = await prisma.course.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      title: true,
      courseNotificationSets: {
        select: {
          notificationSet: {
            select: {
              id: true,
              name: true,
              eventType: true,
              isActive: true,
              template: { select: { type: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const enrollmentSets = await prisma.notificationSet.findMany({
    where: { eventType: 'enrollment', isActive: true },
    include: { template: { select: { type: true, name: true } } },
  });

  console.log('=== Активные NotificationSet с eventType=enrollment ===\n');
  if (enrollmentSets.length === 0) {
    console.log('Нет активных наборов enrollment — сработают только дефолты из lib/email-templates.ts');
  } else {
    for (const s of enrollmentSets) {
      const t = s.template?.type ?? '(нет шаблона)';
      console.log(`- ${s.name} [id=${s.id}] delivery=${t} template=${s.template?.name ?? '—'}`);
    }
  }

  console.log('\n=== Курсы (published) без активного enrollment в привязках ===\n');
  let missing = 0;
  for (const c of publishedCourses) {
    const hasActiveEnrollment = c.courseNotificationSets.some(
      (l) => l.notificationSet.isActive && l.notificationSet.eventType === 'enrollment'
    );
    if (!hasActiveEnrollment) {
      missing++;
      console.log(`- ${c.title} [${c.id}]`);
    }
  }
  if (missing === 0) {
    console.log('Все опубликованные курсы имеют привязку к активному набору enrollment.');
  }

  console.log(
    '\nПодсказка: тип шаблона internal | email | both — см. карточку набора в админке; при both возможно второе письмо после письма об оплате.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
