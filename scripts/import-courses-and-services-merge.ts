/**
 * Импорт курсов (upsert по id) и полная замена витрины Service из JSON.
 * Остальные таблицы БД не трогает. Запуск на проде (cwd = /opt/ALETHEIA):
 *   npx tsx scripts/import-courses-and-services-merge.ts [путь.json]
 * По умолчанию: prisma/data/courses-services-sync.json
 *
 * Перед запуском: остановить aletheia (deploy-rsync уже останавливает) или restart после.
 */
import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import type { CourseExportRow, CoursesServicesSyncPayload, ServiceExportRowWithCourse } from './export-courses-and-services-for-prod';

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

const prisma = new PrismaClient();

function rowToCourseCreateUpdate(row: CourseExportRow) {
  return {
    title: row.title,
    description: row.description,
    startsAt: row.startsAt ? new Date(row.startsAt) : null,
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    scormPath: row.scormPath,
    scormVersion: row.scormVersion,
    scormManifest: row.scormManifest,
    aiContext: row.aiContext,
    aiTutorEnabled: row.aiTutorEnabled,
    thumbnailUrl: row.thumbnailUrl,
    courseFormat: row.courseFormat,
    eventVenue: row.eventVenue,
    eventUrl: row.eventUrl,
    status: row.status,
    openAccessForAllStudents: row.openAccessForAllStudents,
    price: row.price,
    sortOrder: row.sortOrder,
    verificationRequiredLessonIds: row.verificationRequiredLessonIds,
  };
}

async function main() {
  const file =
    process.argv[2] ?? path.join(process.cwd(), 'prisma', 'data', 'courses-services-sync.json');
  const raw = await readFile(file, 'utf8');
  const data = JSON.parse(raw) as CoursesServicesSyncPayload;

  if (!data.courses || !Array.isArray(data.courses) || !data.services || !Array.isArray(data.services)) {
    throw new Error(`Invalid payload in ${file}: need courses[] and services[]`);
  }

  console.log(`[import-courses-services] courses=${data.courses.length}, services=${data.services.length}`);

  await prisma.$transaction(async (tx) => {
    for (const row of data.courses) {
      const body = rowToCourseCreateUpdate(row);
      await tx.course.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          ...body,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          ...body,
        },
      });
    }

    const deleted = await tx.service.deleteMany({});
    console.log(`[import-courses-services] удалено строк Service: ${deleted.count}`);

    for (const r of data.services as ServiceExportRowWithCourse[]) {
      if (!r.slug || typeof r.name !== 'string' || typeof r.price !== 'number') {
        throw new Error(`Invalid service row: ${JSON.stringify(r)}`);
      }
      let courseId: string | null = r.courseId ?? null;
      if (courseId) {
        const exists = await tx.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!exists) {
          console.warn(`[import-courses-services] courseId ${courseId} не найден — service ${r.slug} без курса`);
          courseId = null;
        }
      }
      await tx.service.create({
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
  });

  console.log('[import-courses-services] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
