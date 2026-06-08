/**
 * Пакетная очистка тестовых данных:
 * — Сертификаты (все)
 * — Верификация заданий (PhygitalVerification + переписка в треде)
 * — Пользователи кроме администраторов (Profile.role = admin)
 * — CRM: все лиды (Lead)
 * — Заказы (Order): удаляются все, КРОМЕ созданных в указанную календарную дату (UTC)
 * — Тикеты
 * — Рассылки (Mailing + логи)
 * — Коммуникации: записи отправок (CommsSend)
 * — Журнал уведомлений (NotificationLog)
 *
 * НЕ удаляется: курсы, медиатека, шаблоны CommsTemplate, наборы уведомлений, PayKeeper integration log и т.п.
 *
 * ВНИМАНИЕ: необратимо. Сделайте бэкап БД перед запуском.
 *
 * Использование:
 *   npx tsx scripts/clear-test-data-batch.ts --dry-run
 *   CLEAR_TEST_BATCH_CONFIRM=YES npx tsx scripts/clear-test-data-batch.ts
 *
 * PowerShell:
 *   $env:CLEAR_TEST_BATCH_CONFIRM="YES"; npx tsx scripts/clear-test-data-batch.ts
 *
 * По умолчанию сохраняются оплаты с датой создания 28.04.2026 (UTC, полные сутки).
 * Иначе задайте переменные:
 *   CLEAR_TEST_BATCH_KEEP_ORDER_YEAR=2026 CLEAR_TEST_BATCH_KEEP_ORDER_MONTH=4 CLEAR_TEST_BATCH_KEEP_ORDER_DAY=28
 */
import { prisma } from '../lib/db';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.CLEAR_TEST_BATCH_CONFIRM === 'YES';
  const y = parseInt(process.env.CLEAR_TEST_BATCH_KEEP_ORDER_YEAR ?? '2026', 10);
  const m = parseInt(process.env.CLEAR_TEST_BATCH_KEEP_ORDER_MONTH ?? '4', 10);
  const d = parseInt(process.env.CLEAR_TEST_BATCH_KEEP_ORDER_DAY ?? '28', 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error('Некорректные CLEAR_TEST_BATCH_KEEP_ORDER_*');
  }
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { dryRun, confirm, keepOrdersDayStart: dayStart, keepOrdersDayEnd: dayEnd, label: `${d.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${y}` };
}

async function counts(opts: {
  keepOrdersDayStart: Date;
  keepOrdersDayEnd: Date;
}) {
  const adminProfiles = await prisma.profile.findMany({
    where: { role: 'admin' },
    select: { userId: true },
  });
  const adminIds = adminProfiles.map((p) => p.userId);
  const usersTotal = await prisma.user.count();
  const usersNonAdmin =
    adminIds.length === 0 ? usersTotal : await prisma.user.count({ where: { id: { notIn: adminIds } } });

  const ordersToDelete = await prisma.order.count({
    where: {
      OR: [{ createdAt: { lt: opts.keepOrdersDayStart } }, { createdAt: { gte: opts.keepOrdersDayEnd } }],
    },
  });
  const ordersKept = await prisma.order.count({
    where: {
      createdAt: { gte: opts.keepOrdersDayStart, lt: opts.keepOrdersDayEnd },
    },
  });

  return {
    certificates: await prisma.certificate.count(),
    verifications: await prisma.phygitalVerification.count(),
    tickets: await prisma.ticket.count(),
    mailings: await prisma.mailing.count(),
    commsSend: await prisma.commsSend.count(),
    notificationLogs: await prisma.notificationLog.count(),
    leads: await prisma.lead.count(),
    usersNonAdmin,
    admins: adminIds.length,
    ordersToDelete,
    ordersKept,
  };
}

async function main() {
  const { dryRun, confirm, keepOrdersDayStart, keepOrdersDayEnd, label } = parseArgs();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или установите CLEAR_TEST_BATCH_CONFIRM=YES.\n' +
        'PowerShell: $env:CLEAR_TEST_BATCH_CONFIRM="YES"; npx tsx scripts/clear-test-data-batch.ts'
    );
    process.exit(1);
  }

  const preview = await counts({ keepOrdersDayStart, keepOrdersDayEnd });

  console.log(`[clear-test-batch] dry-run=${dryRun}`);
  console.log(`[clear-test-batch] сохраняем заказы за ${label} (UTC): останется ~${preview.ordersKept}, удалится ~${preview.ordersToDelete}`);
  console.log(`[clear-test-batch] администраторов (не удаляем): ${preview.admins}`);
  console.log(`[clear-test-batch] пользователей к удалению (не админы): ${preview.usersNonAdmin}`);
  console.log(`[clear-test-batch] сертификатов к удалению: ${preview.certificates}`);
  console.log(`[clear-test-batch] верификаций к удалению: ${preview.verifications}`);
  console.log(`[clear-test-batch] тикетов к удалению: ${preview.tickets}`);
  console.log(`[clear-test-batch] рассылок к удалению: ${preview.mailings}`);
  console.log(`[clear-test-batch] отправок коммуникаций к удалению: ${preview.commsSend}`);
  console.log(`[clear-test-batch] записей журнала уведомлений к удалению: ${preview.notificationLogs}`);
  console.log(`[clear-test-batch] лидов CRM к удалению: ${preview.leads}`);

  if (preview.admins === 0) {
    console.error('[clear-test-batch] Нет ни одного пользователя с ролью admin — отказ.');
    process.exit(1);
  }

  if (dryRun) {
    process.exit(0);
  }

  await prisma.$transaction(
    async (tx) => {
      const delCert = await tx.certificate.deleteMany({});
      console.log(`[clear-test-batch] удалено сертификатов: ${delCert.count}`);

      const delPv = await tx.phygitalVerification.deleteMany({});
      console.log(`[clear-test-batch] удалено верификаций: ${delPv.count}`);

      const delTickets = await tx.ticket.deleteMany({});
      console.log(`[clear-test-batch] удалено тикетов: ${delTickets.count}`);

      const delMailings = await tx.mailing.deleteMany({});
      console.log(`[clear-test-batch] удалено рассылок (с логами каскадом): ${delMailings.count}`);

      const delComms = await tx.commsSend.deleteMany({});
      console.log(`[clear-test-batch] удалено отправок коммуникаций: ${delComms.count}`);

      const delNotifLog = await tx.notificationLog.deleteMany({});
      console.log(`[clear-test-batch] удалено записей журнала уведомлений: ${delNotifLog.count}`);

      await tx.lead.updateMany({ data: { convertedToUserId: null } });
      const delLeads = await tx.lead.deleteMany({});
      console.log(`[clear-test-batch] удалено лидов: ${delLeads.count}`);

      const delOrders = await tx.order.deleteMany({
        where: {
          OR: [{ createdAt: { lt: keepOrdersDayStart } }, { createdAt: { gte: keepOrdersDayEnd } }],
        },
      });
      console.log(`[clear-test-batch] удалено заказов (вне сохранённой даты): ${delOrders.count}`);

      const adminProfiles = await tx.profile.findMany({
        where: { role: 'admin' },
        select: { userId: true },
      });
      const adminIds = adminProfiles.map((p) => p.userId);

      const delUsers = await tx.user.deleteMany({
        where: { id: { notIn: adminIds } },
      });
      console.log(`[clear-test-batch] удалено пользователей (не админы): ${delUsers.count}`);
    },
    { timeout: 300_000 }
  );

  console.log('[clear-test-batch] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
