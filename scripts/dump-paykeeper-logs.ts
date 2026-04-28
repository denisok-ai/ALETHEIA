/**
 * Последние записи PaykeeperIntegrationLog (локальная/текущая БД).
 * Запуск: npx tsx scripts/dump-paykeeper-logs.ts [limit]
 */
import { prisma } from '../lib/db';

const limit = Math.min(100, Math.max(1, parseInt(process.argv[2] || '30', 10) || 30));

async function main() {
  const rows = await prisma.paykeeperIntegrationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      createdAt: true,
      direction: true,
      event: true,
      status: true,
      orderNumber: true,
      httpStatus: true,
      message: true,
      invoiceUrl: true,
      payload: true,
    },
  });

  for (const r of rows) {
    const payloadLen = r.payload ? r.payload.length : 0;
    console.log(
      JSON.stringify({
        t: r.createdAt.toISOString(),
        dir: r.direction,
        event: r.event,
        status: r.status,
        order: r.orderNumber,
        http: r.httpStatus,
        invoiceUrl: r.invoiceUrl ? `${r.invoiceUrl.slice(0, 60)}…` : null,
        payloadChars: payloadLen,
        msg: (r.message || '').slice(0, 150),
      })
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
