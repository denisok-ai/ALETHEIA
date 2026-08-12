/**
 * Установка пароля пользователю вручную (поддержка: студент не может войти).
 *
 * Пароли в БД захэшированы bcrypt — прочитать существующий нельзя, только
 * задать новый. Тот же алгоритм, что в приложении (bcryptjs, cost 10 —
 * см. lib/auth.ts). После входа студент может сменить пароль в профиле.
 *
 *   npx tsx scripts/admin-set-user-password.ts <email> <новый-пароль>
 *
 * Кейс 12.08.2026: Руденко Елена оплатила «Практик» 22.07, трижды сбрасывала
 * пароль через сайт, ни разу не вошла — выдаём пароль напрямую.
 */
import { hash, compare } from 'bcryptjs';
import { prisma } from '../lib/db';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Использование: npx tsx scripts/admin-set-user-password.ts <email> <пароль>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Пароль не короче 8 символов.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true },
  });
  if (!user) {
    console.error(`Пользователь ${email} не найден.`);
    process.exit(1);
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  // Удаляем висящие токены сброса: иначе старое письмо «сброс пароля» ещё живо
  // и может перезатереть только что выданный пароль.
  const removed = await prisma.passwordToken.deleteMany({ where: { userId: user.id } }).catch(() => ({ count: 0 }));

  const check = await prisma.user.findUnique({ where: { email }, select: { passwordHash: true } });
  const ok = check ? await compare(password, check.passwordHash) : false;

  console.log(`Пользователь: ${user.displayName ?? email} (${email})`);
  console.log(`Пароль установлен и проверен: ${ok ? 'да' : 'НЕТ — проверьте!'}`);
  console.log(`Токенов сброса удалено: ${removed.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
