/**
 * Удаление данных старого тестового сида: пользователи @test.local / @avaterra.local,
 * курсы course-seed-*, заказы ORD-SEED-*, фиктивные лиды/рассылки и т.д.
 * Курс course-demo-muscle-testing не удаляется.
 *
 * ВНИМАНИЕ: необратимо. Перед продом делайте бэкап БД.
 *
 * Использование:
 *   npx tsx scripts/clean-seed-test-data.ts --dry-run
 *   CLEANSEED_CONFIRM=YES npx tsx scripts/clean-seed-test-data.ts
 *
 * PowerShell:
 *   $env:CLEANSEED_CONFIRM="YES"; npx tsx scripts/clean-seed-test-data.ts
 *
 * Переменные:
 *   CLEANSEED_KEEP_EMAILS=admin@avaterra.local — не удалять перечисленные email
 *
 * Опции:
 *   --dry-run     только подсчёт
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.CLEANSEED_CONFIRM === 'YES';
  const envKeep =
    process.env.CLEANSEED_KEEP_EMAILS?.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return { dryRun, confirm, envKeep };
}

function courseFilter(): Prisma.CourseWhereInput {
  return { id: { startsWith: 'course-seed-' } };
}

async function listUsersToRemove(keep: Set<string>) {
  const rows = await prisma.user.findMany({
    where: {
      OR: [{ email: { endsWith: '@test.local' } }, { email: { endsWith: '@avaterra.local' } }],
    },
    select: { id: true, email: true },
  });
  return rows.filter((r) => !keep.has(r.email.toLowerCase()));
}

async function main() {
  const { dryRun, confirm, envKeep } = parseArgs();
  const keepEmails = new Set(envKeep.map((e) => e.toLowerCase()));

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или установите CLEANSEED_CONFIRM=YES.\n' +
        'PowerShell: $env:CLEANSEED_CONFIRM="YES"; npx tsx scripts/clean-seed-test-data.ts'
    );
    process.exit(1);
  }

  const usersToRemove = await listUsersToRemove(keepEmails);
  const courseWhere = courseFilter();
  const courseIds = await prisma.course.findMany({
    where: courseWhere,
    select: { id: true },
  });
  const courseIdList = courseIds.map((c) => c.id);

  console.log(`[clean-seed] dry-run=${dryRun} users (test/seed) to remove: ${usersToRemove.length}`);
  console.log(`[clean-seed] courses course-seed-* to remove: ${courseIdList.length}`);

  if (dryRun) {
    const orders = await prisma.order.count({ where: { orderNumber: { startsWith: 'ORD-SEED-' } } });
    const leads = await prisma.lead.count({
      where: {
        AND: [{ email: { startsWith: 'lead' } }, { email: { endsWith: '@example.com' } }],
      },
    });
    const mailings = await prisma.mailing.count({ where: { internalTitle: { startsWith: 'Рассылка ' } } });
    console.log(`[clean-seed] counts: ORD-SEED orders=${orders}, seed-like leads=${leads}, mailings «Рассылка …»=${mailings}`);
    process.exit(0);
  }

  const userIds = usersToRemove.map((u) => u.id);

  await prisma.$transaction(
    async (tx) => {
      if (userIds.length) {
        await tx.lead.updateMany({
          where: { convertedToUserId: { in: userIds } },
          data: { convertedToUserId: null },
        });
      }

      await tx.order.deleteMany({ where: { orderNumber: { startsWith: 'ORD-SEED-' } } });

      await tx.lead.deleteMany({
        where: {
          AND: [{ email: { startsWith: 'lead' } }, { email: { endsWith: '@example.com' } }],
        },
      });

      await tx.publication.deleteMany({
        where: { teaser: { startsWith: 'Краткое описание публикации' } },
      });

      await tx.mailing.deleteMany({
        where: { internalTitle: { startsWith: 'Рассылка ' } },
      });

      await tx.mailingUnsubscribe.deleteMany({
        where: { email: { startsWith: 'unsub' } },
      });

      await tx.notificationLog.deleteMany({
        where: { subject: { startsWith: 'Тема уведомления ' } },
      });

      await tx.auditLog.deleteMany({
        where: { entityId: { startsWith: 'entity-' } },
      });

      await tx.commsSend.deleteMany({
        where: {
          subject: { startsWith: 'Сообщение ' },
          OR: [{ recipient: { endsWith: '@test.local' } }, { recipient: { endsWith: '@avaterra.local' } }],
        },
      });

      if (userIds.length) {
        await tx.visitLog.deleteMany({ where: { userId: { in: userIds } } });
        await tx.passwordToken.deleteMany({ where: { userId: { in: userIds } } });
      }

      if (courseIdList.length) {
        await tx.service.updateMany({
          where: { courseId: { in: courseIdList } },
          data: { courseId: null },
        });
      }

      await tx.media.deleteMany({
        where: { title: { startsWith: 'Ресурс «' } },
      });

      if (courseIdList.length) {
        await tx.course.deleteMany({ where: { id: { in: courseIdList } } });
      }

      if (userIds.length) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      async function deleteGroupLeaves(where: Prisma.GroupWhereInput, label: string) {
        let total = 0;
        for (;;) {
          const batch = await tx.group.findMany({
            where: { ...where, children: { none: {} } },
            select: { id: true },
            take: 200,
          });
          if (batch.length === 0) break;
          const r = await tx.group.deleteMany({
            where: { id: { in: batch.map((b) => b.id) } },
          });
          total += r.count;
          if (r.count === 0) break;
        }
        if (total) console.log(`[clean-seed] deleted ${total} group(s) (${label})`);
      }

      await deleteGroupLeaves(
        { moduleType: 'course', name: { startsWith: 'Группа курсов ' } },
        'course'
      );
      await deleteGroupLeaves(
        { moduleType: 'media', name: { startsWith: 'Медиатека:' } },
        'media'
      );
      await deleteGroupLeaves(
        { moduleType: 'user', name: { startsWith: 'Участники:' } },
        'user'
      );
    },
    { timeout: 120_000 }
  );

  console.log('[clean-seed] Готово. При необходимости: npx prisma generate, npm run prod:readiness, npm run predeploy.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
