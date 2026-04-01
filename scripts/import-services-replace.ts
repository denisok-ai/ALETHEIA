/**
 * Удаляет все Service в текущей БД и создаёт заново из JSON.
 * courseId подставляется: первый опубликованный курс, иначе любой курс.
 *
 * На проде (из /opt/ALETHEIA; подхватывается .env из каталога):
 *   npx tsx scripts/import-services-replace.ts [путь.json]
 * По умолчанию: prisma/data/services-for-prod.json
 */
import { existsSync, readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import path from 'path';

/** Минимальная подгрузка .env (без зависимости dotenv), только если переменная ещё не задана в окружении. */
function loadEnvFromCwd() {
  const p = path.join(process.cwd(), '.env');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFromCwd();

/** Должен совпадать с payload в export-services.ts / services-for-prod.json */
type ServiceExportRow = {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  paykeeperTariffId: string | null;
  isActive: boolean;
};

const prisma = new PrismaClient();

async function defaultCourseId(): Promise<string | null> {
  const published = await prisma.course.findFirst({
    where: { status: 'published' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  if (published) return published.id;
  const anyCourse = await prisma.course.findFirst({ orderBy: { createdAt: 'asc' } });
  return anyCourse?.id ?? null;
}

async function main() {
  const file =
    process.argv[2] ?? path.join(process.cwd(), 'prisma', 'data', 'services-for-prod.json');
  const raw = await readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Expected non-empty JSON array in ${file}`);
  }
  const rows = parsed as ServiceExportRow[];
  for (const r of rows) {
    if (!r.slug || typeof r.name !== 'string' || typeof r.price !== 'number') {
      throw new Error(`Invalid row: ${JSON.stringify(r)}`);
    }
  }

  const courseId = await defaultCourseId();
  if (!courseId) {
    console.warn('No Course in DB — services will be created with courseId=null');
  }

  const deleted = await prisma.service.deleteMany({});
  console.log(`Deleted ${deleted.count} existing services`);

  for (const r of rows) {
    await prisma.service.create({
      data: {
        slug: r.slug,
        name: r.name,
        description: r.description ?? null,
        imageUrl: r.imageUrl ?? null,
        price: r.price,
        paykeeperTariffId: r.paykeeperTariffId ?? null,
        isActive: r.isActive !== false,
        courseId,
      },
    });
  }
  console.log(`Inserted ${rows.length} services from ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
