/**
 * Восстановление CRM: создаёт лиды из существующих заказов (Order), если контакт ещё не в Lead.
 * Безопасно для повторного запуска — дубликаты по email/телефону не создаются.
 *
 * Использование:
 *   npx tsx scripts/backfill-leads-from-orders.ts --dry-run
 *   BACKFILL_CONFIRM=YES npx tsx scripts/backfill-leads-from-orders.ts
 */
import { prisma } from '../lib/db';

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.env.BACKFILL_CONFIRM === 'YES';
  return { dryRun, confirm };
}

function normEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  return v && v.includes('@') ? v : null;
}

function normPhoneDigits(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function displayName(order: {
  clientName: string | null;
  clientEmail: string;
}): string {
  const name = order.clientName?.trim();
  if (name) return name.slice(0, 200);
  const local = order.clientEmail.split('@')[0]?.trim();
  if (local) return local.slice(0, 200);
  return 'Клиент';
}

function resolveStatus(orders: Array<{ status: string; userId: string | null }>): string {
  const hasPaidWithUser = orders.some((o) => o.status === 'paid' && o.userId);
  if (hasPaidWithUser) return 'converted';
  const hasPaid = orders.some((o) => o.status === 'paid');
  if (hasPaid) return 'qualified';
  return 'new';
}

function pickLastPaidOrderNumber(
  orders: Array<{ orderNumber: string; status: string; paidAt: Date | null; createdAt: Date }>
): string | null {
  const paid = orders
    .filter((o) => o.status === 'paid')
    .sort((a, b) => {
      const ta = (a.paidAt ?? a.createdAt).getTime();
      const tb = (b.paidAt ?? b.createdAt).getTime();
      return tb - ta;
    });
  return paid[0]?.orderNumber ?? null;
}

function pickConvertedUserId(
  orders: Array<{ status: string; userId: string | null }>
): string | null {
  const paidWithUser = orders.find((o) => o.status === 'paid' && o.userId);
  return paidWithUser?.userId ?? null;
}

async function loadExistingLeadKeys() {
  const leads = await prisma.lead.findMany({
    select: { id: true, email: true, phone: true },
  });
  const byEmail = new Set<string>();
  const byPhone = new Set<string>();
  for (const l of leads) {
    const e = normEmail(l.email);
    if (e) byEmail.add(e);
    const p = normPhoneDigits(l.phone);
    if (p) byPhone.add(p);
  }
  return { byEmail, byPhone, existingCount: leads.length };
}

async function main() {
  const { dryRun, confirm } = parseArgs();

  if (!dryRun && !confirm) {
    console.error(
      'Укажите --dry-run или установите BACKFILL_CONFIRM=YES.\n' +
        'PowerShell: $env:BACKFILL_CONFIRM="YES"; npx tsx scripts/backfill-leads-from-orders.ts'
    );
    process.exit(1);
  }

  const orders = await prisma.order.findMany({
    select: {
      orderNumber: true,
      clientEmail: true,
      clientPhone: true,
      clientName: true,
      status: true,
      userId: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const { byEmail, byPhone, existingCount } = await loadExistingLeadKeys();

  type ContactGroup = {
    email: string | null;
    phone: string | null;
    orders: typeof orders;
  };

  const groups = new Map<string, ContactGroup>();

  for (const order of orders) {
    const email = normEmail(order.clientEmail);
    const phone = normPhoneDigits(order.clientPhone);
    const key = email ? `e:${email}` : phone ? `p:${phone}` : `o:${order.orderNumber}`;

    const group = groups.get(key) ?? { email, phone, orders: [] };
    group.orders.push(order);
    if (!group.email && email) group.email = email;
    if (!group.phone && phone) group.phone = phone;
    groups.set(key, group);
  }

  const toCreate: Array<{
    name: string;
    phone: string;
    email: string | null;
    status: string;
    source: string;
    lastOrderNumber: string | null;
    convertedToUserId: string | null;
    message: string;
  }> = [];

  for (const group of groups.values()) {
    const email = group.email;
    const phoneDigits = group.phone;
    if (email && byEmail.has(email)) continue;
    if (phoneDigits && byPhone.has(phoneDigits)) continue;
    if (!email && !phoneDigits) continue;

    const latestOrder = group.orders[group.orders.length - 1];
    const name = displayName(latestOrder);
    const phone =
      latestOrder.clientPhone?.trim() ||
      (phoneDigits ? `+7${phoneDigits}` : '+70000000000');

    toCreate.push({
      name,
      phone: phone.slice(0, 50),
      email,
      status: resolveStatus(group.orders),
      source: 'order',
      lastOrderNumber: pickLastPaidOrderNumber(group.orders),
      convertedToUserId: pickConvertedUserId(group.orders),
      message: `Восстановлено из ${group.orders.length} заказ(ов)`,
    });

    if (email) byEmail.add(email);
    if (phoneDigits) byPhone.add(phoneDigits);
  }

  console.log(`[backfill] dry-run=${dryRun}`);
  console.log(`[backfill] заказов в БД: ${orders.length}`);
  console.log(`[backfill] лидов до: ${existingCount}`);
  console.log(`[backfill] лидов к созданию: ${toCreate.length}`);

  for (const lead of toCreate) {
    console.log(
      `  + ${lead.name} | ${lead.email ?? '—'} | ${lead.phone} | ${lead.status} | ${lead.lastOrderNumber ?? '—'}`
    );
  }

  if (dryRun) process.exit(0);

  let created = 0;
  for (const data of toCreate) {
    await prisma.lead.create({ data });
    created += 1;
  }

  const after = await prisma.lead.count();
  console.log(`[backfill] создано: ${created}`);
  console.log(`[backfill] лидов после: ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
