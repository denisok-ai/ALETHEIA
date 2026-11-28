/**
 * Пароли, которые лежат в публичном репозитории (сид prisma/seed.ts) и потому
 * считаются известными всем.
 *
 * Инцидент 28.11.2026: на проде у admin@test.local (рабочая учётка владельца) и двух
 * тестовых менеджеров стоял пароль из сида — войти админом мог любой читатель репозитория.
 * Пароли сменены; ежедневная проверка content-integrity ищет такие учётки снова
 * (например, если сид прогонят на проде) и шлёт тревогу.
 */
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { SEED_DEV_PASSWORD } from './seed-dev-password';

export { SEED_DEV_PASSWORD };

export const KNOWN_PUBLIC_PASSWORDS: readonly string[] = [SEED_DEV_PASSWORD];

/** Email учёток, чей пароль совпадает с одним из публичных. */
export async function findAccountsWithPublicPassword(): Promise<string[]> {
  // passwordHash обязателен в схеме: фильтр { not: null } упал бы в рантайме (CLAUDE.md, грабли Prisma).
  const users = await prisma.user.findMany({ select: { email: true, passwordHash: true } });
  const found: string[] = [];
  for (const u of users) {
    if (!u.passwordHash) continue;
    for (const pw of KNOWN_PUBLIC_PASSWORDS) {
      if (await compare(pw, u.passwordHash)) {
        found.push(u.email);
        break;
      }
    }
  }
  return found;
}
