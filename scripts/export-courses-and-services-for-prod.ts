/**
 * Экспорт курсов (только задействованных в витрине Service) и всех Service для переноса на прод.
 * Даты — ISO-строки. Запуск на машине с тестовой БД:
 *   npx tsx scripts/export-courses-and-services-for-prod.ts [путь.json]
 * По умолчанию: prisma/data/courses-services-sync.json
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/db';

export type CourseExportRow = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  scormPath: string | null;
  scormVersion: string | null;
  scormManifest: string | null;
  aiContext: string | null;
  aiTutorEnabled: boolean;
  thumbnailUrl: string | null;
  courseFormat: string;
  eventVenue: string | null;
  eventUrl: string | null;
  status: string;
  openAccessForAllStudents: boolean;
  price: number | null;
  sortOrder: number;
  verificationRequiredLessonIds: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceExportRowWithCourse = {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  paykeeperTariffId: string | null;
  isActive: boolean;
  courseId: string | null;
};

export type CoursesServicesSyncPayload = {
  exportedAt: string;
  courses: CourseExportRow[];
  services: ServiceExportRowWithCourse[];
};

function courseToRow(c: {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  scormPath: string | null;
  scormVersion: string | null;
  scormManifest: string | null;
  aiContext: string | null;
  aiTutorEnabled: boolean;
  thumbnailUrl: string | null;
  courseFormat: string;
  eventVenue: string | null;
  eventUrl: string | null;
  status: string;
  openAccessForAllStudents: boolean;
  price: number | null;
  sortOrder: number;
  verificationRequiredLessonIds: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CourseExportRow {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    scormPath: c.scormPath,
    scormVersion: c.scormVersion,
    scormManifest: c.scormManifest,
    aiContext: c.aiContext,
    aiTutorEnabled: c.aiTutorEnabled,
    thumbnailUrl: c.thumbnailUrl,
    courseFormat: c.courseFormat,
    eventVenue: c.eventVenue,
    eventUrl: c.eventUrl,
    status: c.status,
    openAccessForAllStudents: c.openAccessForAllStudents,
    price: c.price,
    sortOrder: c.sortOrder,
    verificationRequiredLessonIds: c.verificationRequiredLessonIds,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function main() {
  const out =
    process.argv[2] ?? path.join(process.cwd(), 'prisma', 'data', 'courses-services-sync.json');

  const services = await prisma.service.findMany({ orderBy: { slug: 'asc' } });
  const courseIds = [...new Set(services.map((s) => s.courseId).filter(Boolean))] as string[];

  const courses =
    courseIds.length > 0
      ? await prisma.course.findMany({ where: { id: { in: courseIds } } })
      : [];

  const payload: CoursesServicesSyncPayload = {
    exportedAt: new Date().toISOString(),
    courses: courses.map(courseToRow),
    services: services.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      imageUrl: s.imageUrl,
      price: s.price,
      paykeeperTariffId: s.paykeeperTariffId,
      isActive: s.isActive,
      courseId: s.courseId,
    })),
  };

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${payload.courses.length} courses, ${payload.services.length} services → ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
