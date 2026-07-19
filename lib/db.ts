/**
 * Prisma client — локальная БД (SQLite).
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaPragmasApplied: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Режим журналирования и ожидание блокировки.
 *
 * По умолчанию SQLite работает в режиме `delete`: читатель блокирует писателя и
 * наоборот, а `busy_timeout=0` означает, что конкурирующий запрос падает с
 * SQLITE_BUSY сразу, не дожидаясь освобождения. На проде так и было (проверено
 * 19.07.2026: journal_mode=delete, busy_timeout=0) — при одновременных
 * SCORM-коммитах, ping-хартбитах и открытии отчётов это давало случайные отказы.
 *
 * WAL снимает взаимную блокировку читателей и писателя и сохраняется в самом
 * файле БД (применяется один раз, переживает перезапуск). Бэкап делается через
 * `sqlite3 .backup` — корректный онлайн-снапшот, WAL ему не мешает.
 *
 * busy_timeout задаётся на соединение, а пул Prisma открывает их лениво,
 * поэтому гарантии на все соединения эта установка не даёт — она снижает
 * частоту отказов, но не заменяет ретрай в вызывающем коде.
 */
async function applySqlitePragmas(): Promise<void> {
  try {
    // Именно $queryRawUnsafe: обе PRAGMA возвращают строку результата, а
    // $executeRawUnsafe в SQLite отвергает такие запросы («Execute returned
    // results») — настройка молча не применилась бы.
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000');
  } catch (e) {
    console.error('[db] не удалось применить PRAGMA (WAL/busy_timeout):', e);
  }
}

if (!globalForPrisma.prismaPragmasApplied) {
  globalForPrisma.prismaPragmasApplied = true;
  void applySqlitePragmas();
}
