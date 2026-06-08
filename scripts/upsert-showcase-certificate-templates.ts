/**
 * Создаёт/обновляет шаблоны сертификатов для курсов витрины с встроенным PDF-макетом (поле pdfLayout в JSON).
 *
 *   npx tsx scripts/upsert-showcase-certificate-templates.ts
 */
import { prisma } from '../lib/db';

const ROWS = [
  {
    courseId: 'course-probuzhdenie',
    name: 'Витрина · Пробуждение (PDF)',
    pdfLayout: 'awaken' as const,
  },
  {
    courseId: 'course-seed-1',
    name: 'Витрина · Витальность (PDF)',
    pdfLayout: 'vitality' as const,
  },
  {
    courseId: 'course-probnyy-2',
    name: 'Витрина · Первый шаг (PDF)',
    pdfLayout: 'path' as const,
  },
];

async function main() {
  for (const row of ROWS) {
    const course = await prisma.course.findUnique({ where: { id: row.courseId }, select: { id: true, title: true } });
    if (!course) {
      console.warn(`[upsert-showcase-cert-templates] курс не найден, пропуск: ${row.courseId}`);
      continue;
    }
    const textMapping = JSON.stringify({ pdfLayout: row.pdfLayout });
    const existing = await prisma.certificateTemplate.findFirst({
      where: { courseId: row.courseId, name: row.name },
    });
    if (existing) {
      await prisma.certificateTemplate.update({
        where: { id: existing.id },
        data: {
          textMapping,
          backgroundImageUrl: null,
          allowUserDownload: true,
          requiredStatus: 'completed',
        },
      });
      console.log('OK update', row.name, '→', course.title);
    } else {
      await prisma.certificateTemplate.create({
        data: {
          name: row.name,
          courseId: row.courseId,
          textMapping,
          backgroundImageUrl: null,
          allowUserDownload: true,
          requiredStatus: 'completed',
          numberingFormat: 'AVT-YYYY-NNNN',
          validityDays: 730,
        },
      });
      console.log('OK create', row.name, '→', course.title);
    }
  }
  console.log('[upsert-showcase-cert-templates] Готово.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
