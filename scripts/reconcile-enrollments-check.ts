/**
 * Проверки сверки «оплачено, но доступа нет» (lib/payments/reconcile-enrollments.ts).
 * Запуск: npx tsx scripts/reconcile-enrollments-check.ts
 *
 * Работает на временной БД в скрэтчпаде — прод и dev.db не затрагиваются.
 * Половина проверок — на ЛОЖНЫЕ срабатывания: сверка выдаёт доступ, поэтому
 * ошибка в сторону «нашла лишнее» дороже, чем «не нашла».
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-check-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_URL = `file:${dbPath}`;

execSync(`npx prisma db push --skip-generate --accept-data-loss`, {
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  stdio: 'pipe',
});

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  const { findMissingEnrollments } = await import('../lib/payments/reconcile-enrollments');

  let failed = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) console.log(`ok   ${name}`);
    else {
      failed++;
      console.log(`FAIL ${name}${detail ? `\n     ${detail}` : ''}`);
    }
  };

  const course = await db.course.create({
    data: { id: 'c-test', title: 'Тестовый курс', status: 'published' },
  });
  await db.service.create({
    data: {
      id: 's-test',
      name: 'Тариф с курсом',
      slug: 'tarif-s-kursom',
      price: 1000,
      isActive: true,
      courseId: course.id,
    },
  });
  await db.service.create({
    data: {
      id: 's-nocourse',
      name: 'Тариф без курса',
      slug: 'tarif-bez-kursa',
      price: 500,
      isActive: true,
    },
  });

  const user = await db.user.create({
    data: { id: 'u-1', email: 'client@example.com', passwordHash: 'x' },
  });

  const mkOrder = (over: Record<string, unknown>) =>
    db.order.create({
      data: {
        orderNumber: `N-${Math.random().toString(36).slice(2, 10)}`,
        clientEmail: 'client@example.com',
        amount: 1000,
        status: 'paid',
        tariffId: 'tarif-s-kursom',
        ...over,
      } as never,
    });

  // 1. Основной случай: оплачено, аккаунт есть, зачисления нет
  const broken = await mkOrder({});
  let r = await findMissingEnrollments();
  check(
    'находит оплаченный заказ без зачисления',
    r.missing.some((m) => m.orderNumber === broken.orderNumber && !m.needsUser),
    `найдено: ${JSON.stringify(r.missing.map((m) => m.orderNumber))}`
  );

  // 2. После выдачи доступа расхождение исчезает
  await db.enrollment.create({ data: { userId: user.id, courseId: course.id } });
  r = await findMissingEnrollments();
  check(
    'при наличии зачисления расхождения нет',
    !r.missing.some((m) => m.orderNumber === broken.orderNumber)
  );

  // 3. Товар без курса — не расхождение (персональные товары)
  const noCourse = await mkOrder({ tariffId: 'tarif-bez-kursa' });
  r = await findMissingEnrollments();
  check(
    'товар без курса не считается расхождением',
    !r.missing.some((m) => m.orderNumber === noCourse.orderNumber)
  );

  // 4. Неоплаченный заказ не трогаем
  const pending = await mkOrder({ status: 'pending', clientEmail: 'other@example.com' });
  r = await findMissingEnrollments();
  check(
    'заказ в статусе pending игнорируется',
    !r.missing.some((m) => m.orderNumber === pending.orderNumber)
  );

  // 5. Возвращённый заказ не должен получать доступ
  const refunded = await mkOrder({
    clientEmail: 'refund@example.com',
    refundedAmountRub: 1000,
  });
  r = await findMissingEnrollments();
  check(
    'возвращённый заказ доступ не получает',
    !r.missing.some((m) => m.orderNumber === refunded.orderNumber),
    'это защита от выдачи доступа тому, кому его закрыли намеренно'
  );

  // 6. Нет аккаунта — помечается как требующий внимания, а не чинится молча
  const noUser = await mkOrder({ clientEmail: 'noaccount@example.com' });
  r = await findMissingEnrollments();
  const found = r.missing.find((m) => m.orderNumber === noUser.orderNumber);
  check('заказ без аккаунта помечен needsUser', found?.needsUser === true);

  // 7. Сумма попадает в отчёт (админ отличает тестовые оплаты)
  check('сумма заказа есть в отчёте', found?.amount === 1000);

  // 8. Намеренный отзыв доступа не откатывается автоматикой.
  //    Признак: Order.userId заполнен (значит зачисление было и его удалили),
  //    в отличие от оборвавшегося потока, где userId так и остался пустым.
  const revoked = await mkOrder({ clientEmail: 'revoked@example.com' });
  const revokedUser = await db.user.create({
    data: { id: 'u-rev', email: 'revoked@example.com', passwordHash: 'x' },
  });
  await db.order.update({
    where: { orderNumber: revoked.orderNumber },
    data: { userId: revokedUser.id },
  });
  const { reconcileEnrollments } = await import('../lib/payments/reconcile-enrollments');
  const res = await reconcileEnrollments({ repair: true });
  const stillNoAccess = await db.enrollment.count({
    where: { userId: revokedUser.id, courseId: course.id },
  });
  check(
    'отозванный доступ не восстанавливается автоматически',
    stillNoAccess === 0 && !res.repaired.includes(revoked.orderNumber),
    'иначе админ не смог бы отозвать доступ: сверка возвращала бы его каждые 10 минут'
  );
  check(
    'отозванный заказ вынесен админам',
    res.needsAttention.some((m) => m.orderNumber === revoked.orderNumber && m.looksRevoked)
  );

  // 8b. repairEnrollmentForOrder вызывается не только из processPaidOrder, но и
  //     из ранней ветки идемпотентности в маршруте вебхука. Проверяем саму
  //     функцию на обоих состояниях: разрыв между ней и маршрутом стоил живой
  //     поломки (самолечение было недостижимо на самом частом пути).
  const { repairEnrollmentForOrder } = await import('../lib/payments/reconcile-enrollments');
  check(
    'точечное восстановление не трогает отозванный доступ',
    (await repairEnrollmentForOrder(revoked.orderNumber)) === false
  );

  // 9. А оборвавшийся поток (userId пуст) — чинится
  const brokenFlow = await mkOrder({ clientEmail: 'client@example.com' });
  await db.enrollment.deleteMany({ where: { userId: user.id, courseId: course.id } });
  const res2 = await reconcileEnrollments({ repair: true });
  const restored = await db.enrollment.count({
    where: { userId: user.id, courseId: course.id },
  });
  check(
    'оборвавшийся поток восстанавливается',
    restored === 1 && res2.repaired.includes(brokenFlow.orderNumber)
  );

  await db.$disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(failed ? `\n${failed} проверок упало` : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});
