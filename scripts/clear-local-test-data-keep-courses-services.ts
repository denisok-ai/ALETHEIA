/**
 * Локальная очистка тестовых данных с сохранением курсов, товаров (Service),
 * системных настроек, шаблонов уведомлений и учёток admin/manager.
 *
 * НЕ для продакшена. Перед запуском сделайте бэкап БД.
 *
 *   npx tsx scripts/clear-local-test-data-keep-courses-services.ts --dry-run
 *   LOCAL_CLEAN_CONFIRM=YES npx tsx scripts/clear-local-test-data-keep-courses-services.ts
 *
 * Опции:
 *   --dry-run              только счётчики
 *   LOCAL_CLEAN_MEDIA=YES  также удалить Media и public/uploads/media
 *   LOCAL_CLEAN_KEEP_EMAILS=a@b.com,c@d.com — не удалять этих пользователей (если не admin/manager)
 */
import { rm, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from '../lib/db';

const MEDIA_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads', 'media');

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.LOCAL_CLEAN_CONFIRM === 'YES';
  const cleanMedia = process.env.LOCAL_CLEAN_MEDIA === 'YES';
  const extraKeep =
    process.env.LOCAL_CLEAN_KEEP_EMAILS?.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return { dryRun, confirm, cleanMedia, extraKeep };
}

function assertSafeToRun() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[local-clean] Отказ: NODE_ENV=production');
    process.exit(1);
  }
  const url = (process.env.DATABASE_URL || '').toLowerCase();
  if (!url) {
    console.error('[local-clean] Отказ: DATABASE_URL не задан');
    process.exit(1);
  }
  const prodMarkers = ['95.181.224.70', 'avaterra.pro', 'neon.tech', 'supabase.co', 'amazonaws.com'];
  for (const m of prodMarkers) {
    if (url.includes(m)) {
      console.error(`[local-clean] Отказ: DATABASE_URL похож на удалённый/прод (${m})`);
      process.exit(1);
    }
  }
  if (url.startsWith('file:')) return;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return;
  console.error('[local-clean] Отказ: DATABASE_URL не file: и не localhost — для безопасности только локальные БД');
  process.exit(1);
}

async function main() {
  const { dryRun, confirm, cleanMedia, extraKeep } = parseArgs();
  assertSafeToRun();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или LOCAL_CLEAN_CONFIRM=YES.\n' +
        'PowerShell: $env:LOCAL_CLEAN_CONFIRM="YES"; npx tsx scripts/clear-local-test-data-keep-courses-services.ts'
    );
    process.exit(1);
  }

  const staff = await prisma.profile.findMany({
    where: { role: { in: ['admin', 'manager'] } },
    select: { userId: true, user: { select: { email: true } } },
  });
  const keepIds = new Set(staff.map((p) => p.userId));

  const extraUsers = await prisma.user.findMany({
    where: { email: { in: extraKeep } },
    select: { id: true, email: true },
  });
  for (const u of extraUsers) keepIds.add(u.id);

  if (keepIds.size === 0) {
    console.error('[local-clean] Нет ни одного admin/manager — отказ (потеряете доступ).');
    process.exit(1);
  }

  const counts = {
    lead: await prisma.lead.count(),
    order: await prisma.order.count(),
    paykeeperLog: await prisma.paykeeperIntegrationLog.count(),
    mailing: await prisma.mailing.count(),
    notificationLog: await prisma.notificationLog.count(),
    commsSend: await prisma.commsSend.count(),
    auditLog: await prisma.auditLog.count(),
    publication: await prisma.publication.count(),
    publicationComment: await prisma.publicationComment.count(),
    user: await prisma.user.count(),
    toDeleteUser: (await prisma.user.findMany({ select: { id: true } })).filter((u) => !keepIds.has(u.id)).length,
    media: await prisma.media.count(),
  };

  console.log('[local-clean] dry-run=', dryRun, 'cleanMedia=', cleanMedia);
  console.log('[local-clean] сохраняем admin/manager (+ LOCAL_CLEAN_KEEP_EMAILS):', keepIds.size, 'учёток');
  console.log('[local-clean] счётчики:', counts);

  if (dryRun) {
    process.exit(0);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.lead.deleteMany({});

      await tx.paykeeperIntegrationLog.deleteMany({});

      await tx.order.deleteMany({});

      await tx.mailing.deleteMany({});
      await tx.mailingUnsubscribe.deleteMany({});

      await tx.notificationLog.deleteMany({});

      await tx.commsSend.deleteMany({});

      await tx.auditLog.deleteMany({});

      await tx.publicationComment.deleteMany({});
      await tx.publication.deleteMany({});

      if (cleanMedia) {
        await tx.media.deleteMany({});
      }

      const deleteIds = (
        await tx.user.findMany({
          where: { id: { notIn: Array.from(keepIds) } },
          select: { id: true },
        })
      ).map((u) => u.id);

      if (deleteIds.length) {
        await tx.user.deleteMany({ where: { id: { in: deleteIds } } });
      }
    },
    { timeout: 300_000 }
  );

  if (cleanMedia && existsSync(MEDIA_UPLOAD_ROOT)) {
    await rm(MEDIA_UPLOAD_ROOT, { recursive: true, force: true });
    await mkdir(MEDIA_UPLOAD_ROOT, { recursive: true });
    console.log('[local-clean] Каталог public/uploads/media пересоздан.');
  }

  console.log('[local-clean] Готово. Курсы, Service, SystemSetting, шаблоны уведомлений сохранены.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
