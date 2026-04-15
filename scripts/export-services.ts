/**
 * Экспорт всех строк Service в JSON (для переноса на прод).
 * Запуск на машине с актуальной БД: npx tsx scripts/export-services.ts [путь.json]
 * По умолчанию: prisma/data/services-for-prod.json
 */
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

export type ServiceExportRow = {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  paykeeperTariffId: string | null;
  isActive: boolean;
};

async function main() {
  const out =
    process.argv[2] ?? path.join(process.cwd(), 'prisma', 'data', 'services-for-prod.json');
  const rows = await prisma.service.findMany({ orderBy: { slug: 'asc' } });
  const payload: ServiceExportRow[] = rows.map(
    ({ slug, name, description, imageUrl, price, paykeeperTariffId, isActive }) => ({
      slug,
      name,
      description,
      imageUrl,
      price,
      paykeeperTariffId,
      isActive,
    }),
  );
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${payload.length} services to ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
