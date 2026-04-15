/**
 * Очистка CRM (все лиды) и пользователей со ролью «студент» (user).
 * Учётки admin и manager не удаляются.
 *
 * Использование:
 *   npx tsx scripts/clear-crm-and-users.ts --dry-run
 *   CRMCLEAN_CONFIRM=YES npx tsx scripts/clear-crm-and-users.ts
 *
 * PowerShell:
 *   $env:CRMCLEAN_CONFIRM="YES"; npx tsx scripts/clear-crm-and-users.ts
 *
 * Переменная CRMCLEAN_KEEP_EMAILS — через запятую дополнительные email, которые не удалять
 * (если у них роль user).
 */
import { prisma } from '../lib/db';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.CRMCLEAN_CONFIRM === 'YES';
  const extraKeep =
    process.env.CRMCLEAN_KEEP_EMAILS?.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return { dryRun, confirm, extraKeep };
}

async function main() {
  const { dryRun, confirm, extraKeep } = parseArgs();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или установите CRMCLEAN_CONFIRM=YES.\n' +
        'PowerShell: $env:CRMCLEAN_CONFIRM="YES"; npx tsx scripts/clear-crm-and-users.ts'
    );
    process.exit(1);
  }

  const staff = await prisma.profile.findMany({
    where: { role: { in: ['admin', 'manager'] } },
    select: { userId: true, role: true, user: { select: { email: true } } },
  });
  const keepIds = new Set(staff.map((p) => p.userId));

  const extraUsers = await prisma.user.findMany({
    where: { email: { in: extraKeep } },
    select: { id: true, email: true },
  });
  for (const u of extraUsers) {
    keepIds.add(u.id);
  }

  if (keepIds.size === 0) {
    console.error('Нет ни одного пользователя admin/manager — отказ (иначе потеряете доступ).');
    process.exit(1);
  }

  const leadCount = await prisma.lead.count();
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const toDeleteUsers = allUsers.filter((u) => !keepIds.has(u.id));

  console.log(`[crmclean] dry-run=${dryRun}`);
  console.log(`[crmclean] сохраняем роли admin/manager: ${staff.length} учёток`);
  if (extraUsers.length) console.log(`[crmclean] дополнительно не трогаем по email: ${extraUsers.map((u) => u.email).join(', ')}`);
  console.log(`[crmclean] лидов к удалению: ${leadCount}`);
  console.log(`[crmclean] пользователей к удалению (студенты и пр.): ${toDeleteUsers.length}`);

  if (dryRun) {
    if (toDeleteUsers.length <= 20) {
      for (const u of toDeleteUsers) console.log(`  - ${u.email}`);
    }
    process.exit(0);
  }

  await prisma.lead.updateMany({ data: { convertedToUserId: null } });
  await prisma.lead.deleteMany({});

  const deleted = await prisma.user.deleteMany({
    where: { id: { notIn: [...keepIds] } },
  });

  console.log(`[crmclean] Готово. Удалено пользователей: ${deleted.count}. Лиды: все (${leadCount} шт.).`);
  console.log('[crmclean] Заказы сохранены (у удалённых пользователей userId станет null там, где предусмотрено схемой).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
