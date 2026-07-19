/**
 * Интеграционные проверки обработки оплаты (lib/paykeeper-webhook-process.ts).
 * Запуск: npx tsx scripts/payment-webhook-check.ts
 *
 * Дополняет scripts/payment-flow-check.ts: тот проверяет статические функции
 * заказа, этот — поведение обработчика вебхука на живой БД.
 *
 * Работает на временной БД в скрэтчпаде — прод и dev.db не затрагиваются.
 * Письма и Telegram здесь не настроены и отваливаются штатно (в warnings),
 * поэтому проверяем состояние БД: доступ, идемпотентность, запреты.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payhook-check-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_URL = `file:${dbPath}`;

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  stdio: 'pipe',
});

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) console.log(`ok   ${name}`);
  else {
    failed++;
    console.log(`FAIL ${name}${detail ? `\n     ${detail}` : ''}`);
  }
};

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  const { processPaidOrder } = await import('../lib/paykeeper-webhook-process');

  await db.course.create({ data: { id: 'c-1', title: 'Курс', status: 'published' } });
  await db.service.create({
    data: {
      id: 's-1',
      name: 'Тариф',
      slug: 'tarif',
      price: 1000,
      isActive: true,
      courseId: 'c-1',
      paykeeperTariffId: 'tarif',
    },
  });

  const accessCount = async (email: string) => {
    const u = await db.user.findFirst({ where: { email } });
    if (!u) return 0;
    return db.enrollment.count({ where: { userId: u.id, courseId: 'c-1' } });
  };

  const mkOrder = (orderNumber: string, email: string, over: Record<string, unknown> = {}) =>
    db.order.create({
      data: {
        orderNumber,
        clientEmail: email,
        amount: 1000,
        status: 'pending',
        tariffId: 'tarif',
        ...over,
      } as never,
    });

  // 1. Обычная оплата
  await mkOrder('N-1', 'a@example.com');
  const r1 = await processPaidOrder('N-1');
  check('оплата выдаёт доступ', r1.success && (await accessCount('a@example.com')) === 1);

  const u1 = await db.user.findFirst({ where: { email: 'a@example.com' } });
  const p1 = u1 ? await db.profile.findFirst({ where: { userId: u1.id } }) : null;
  check('профиль создан вместе с пользователем', !!p1 && p1.role === 'user');

  const o1 = await db.order.findUnique({ where: { orderNumber: 'N-1' } });
  check('заказ помечен оплаченным и связан с пользователем', o1?.status === 'paid' && o1.userId === u1?.id);

  // 2. Идемпотентность
  const r2 = await processPaidOrder('N-1');
  check(
    'повторная обработка не создаёт второе зачисление',
    r2.alreadyPaid === true && (await accessCount('a@example.com')) === 1
  );

  // 3. Самолечение — главный сценарий
  const user1 = await db.user.findFirstOrThrow({ where: { email: 'a@example.com' } });
  await db.enrollment.deleteMany({ where: { userId: user1.id, courseId: 'c-1' } });
  check('подготовка: доступ удалён', (await accessCount('a@example.com')) === 0);

  const r3 = await processPaidOrder('N-1');
  check(
    'повторный вебхук восстанавливает пропавший доступ',
    r3.enrollmentCreated === true && (await accessCount('a@example.com')) === 1,
    'раньше ветка «уже оплачен» просто выходила и доступ не выдавал никто'
  );

  // 4. Возвращённый заказ
  await mkOrder('N-2', 'b@example.com', { status: 'refunded', refundedAmountRub: 1000 });
  const r4 = await processPaidOrder('N-2');
  const o2 = await db.order.findUnique({ where: { orderNumber: 'N-2' } });
  check(
    'возвращённый заказ не переводится в paid',
    o2?.status === 'refunded' && (r4.warnings?.length ?? 0) > 0
  );
  check('возвращённому заказу не выдан доступ', (await accessCount('b@example.com')) === 0);

  // 5. Отменённый заказ
  await mkOrder('N-3', 'c@example.com', { status: 'cancelled' });
  await processPaidOrder('N-3');
  const o3 = await db.order.findUnique({ where: { orderNumber: 'N-3' } });
  check('отменённый заказ не переводится в paid', o3?.status === 'cancelled');
  check('отменённому заказу не выдан доступ', (await accessCount('c@example.com')) === 0);

  // 6. Существующий пользователь без профиля
  const orphan = await db.user.create({ data: { email: 'd@example.com', passwordHash: 'x' } });
  await mkOrder('N-4', 'd@example.com');
  await processPaidOrder('N-4');
  const orphanProfile = await db.profile.findFirst({ where: { userId: orphan.id } });
  check('пользователю без профиля профиль достроен', !!orphanProfile);
  check('и доступ выдан', (await accessCount('d@example.com')) === 1);

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
