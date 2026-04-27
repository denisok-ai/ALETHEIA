/**
 * Удаляет тестовые группы курсов и пользователей, созданные prisma/seed.ts
 * (имена «Группа курсов N» и «Участники: … N»).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_COURSE_GROUP = /^Группа курсов \d+$/;
const SEED_USER_GROUP =
  /^Участники: (Новички|Практики|Выпускники|Корпоративные|VIP) \d+$/;

async function main() {
  const groups = await prisma.group.findMany({
    where: { moduleType: { in: ['course', 'user'] } },
    select: { id: true, name: true, moduleType: true },
  });
  const ids = groups
    .filter(
      (g) =>
        (g.moduleType === 'course' && SEED_COURSE_GROUP.test(g.name)) ||
        (g.moduleType === 'user' && SEED_USER_GROUP.test(g.name)),
    )
    .map((g) => g.id);

  if (ids.length === 0) {
    console.log('Нет подходящих тестовых групп (курсы/пользователи).');
    return;
  }

  const res = await prisma.group.deleteMany({ where: { id: { in: ids } } });
  console.log(`Удалено групп: ${res.count} (связи CourseGroup/UserGroup сняты каскадом).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
