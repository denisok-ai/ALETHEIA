/**
 * Создаёт очный курс «Пробуждение» (`courseFormat: 'live_event'`) и связанные
 * товары в витрине: групповой и индивидуальный тарифы. Идемпотентен.
 *
 * Запуск локально: `npx tsx scripts/setup-probuzhdenie-course.ts`
 * На проде: `npx tsx scripts/setup-probuzhdenie-course.ts` из `/opt/ALETHEIA`
 *           (см. `scripts/setup-probuzhdenie-remote.sh`).
 */
import { prisma } from '../lib/db';

const COURSE_ID = 'course-probuzhdenie';
const TITLE = 'Пробуждение';
const DESCRIPTION =
  'Курс практик на осознанность. 21 день глубоких практик настоящего момента: выход из стресса и автопилота, контакт с собой и Источником.';

const SERVICES: {
  slug: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string | null;
  paykeeperTariffId?: string | null;
}[] = [
  {
    slug: 'probuzhdenie-group',
    name: '«Пробуждение» — групповой формат',
    description:
      'Пробуждение в группе с поддержкой мастера. 3 недели практик настоящего момента, чат участников и живые встречи.\n• 3 недели практик «настоящего момента»\n• Доступ к материалам без ограничений по времени\n• Работа в чате и с мастером в группе\n• Живые встречи с разбором практик',
    price: 22000,
    imageUrl: '/images/probuzhdenie/probuzhdenie-group-cover.png',
    paykeeperTariffId: 'probuzhdenie-group',
  },
  {
    slug: 'probuzhdenie-individual',
    name: '«Пробуждение» — индивидуально',
    description:
      'Личное сопровождение мастера в индивидуальном темпе. Все практики адаптируются под запрос.\n• 3 недели практик «настоящего момента»\n• Доступ к материалам без ограничений по времени\n• Работа в личном чате с мастером\n• Индивидуальный разбор практик и обратная связь',
    price: 44000,
    imageUrl: '/images/probuzhdenie/card-cover.png',
    paykeeperTariffId: 'probuzhdenie-individual',
  },
];

async function ensureCourseGroupLink(courseId: string) {
  const courseGroup =
    (await prisma.group.findFirst({
      where: { moduleType: 'course', name: 'Курсы' },
    })) ??
    (await prisma.group.create({
      data: { name: 'Курсы', moduleType: 'course', displayOrder: 0 },
    }));
  await prisma.courseGroup.upsert({
    where: { courseId_groupId: { courseId, groupId: courseGroup.id } },
    create: { courseId, groupId: courseGroup.id },
    update: {},
  });
}

async function main() {
  const maxSort = await prisma.course.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  await prisma.course.upsert({
    where: { id: COURSE_ID },
    create: {
      id: COURSE_ID,
      title: TITLE,
      description: DESCRIPTION,
      thumbnailUrl: '/images/probuzhdenie/card-cover.png',
      status: 'published',
      sortOrder,
      courseFormat: 'live_event',
      eventVenue: 'Очно и онлайн (по согласованию с мастером)',
      price: 22000,
      aiTutorEnabled: false,
    },
    update: {
      title: TITLE,
      description: DESCRIPTION,
      thumbnailUrl: '/images/probuzhdenie/card-cover.png',
      status: 'published',
      courseFormat: 'live_event',
      eventVenue: 'Очно и онлайн (по согласованию с мастером)',
      price: 22000,
    },
  });

  await ensureCourseGroupLink(COURSE_ID);

  for (const s of SERVICES) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        price: s.price,
        paykeeperTariffId: s.paykeeperTariffId ?? null,
        courseId: COURSE_ID,
        imageUrl: s.imageUrl ?? null,
        isActive: true,
      },
      update: {
        name: s.name,
        description: s.description,
        price: s.price,
        paykeeperTariffId: s.paykeeperTariffId ?? null,
        courseId: COURSE_ID,
        imageUrl: s.imageUrl ?? null,
        isActive: true,
      },
    });
  }

  console.log('--- Готово ---');
  console.log({
    courseId: COURSE_ID,
    title: TITLE,
    services: SERVICES.map((s) => `${s.slug} — ${s.price.toLocaleString('ru-RU')} ₽`),
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
