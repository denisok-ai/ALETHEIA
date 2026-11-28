/**
 * Учётки с паролем из публичного сида (инцидент 28.11.2026: admin@test.local на проде
 * был открыт паролем из prisma/seed.ts).
 */
import { describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';

const users: { email: string; passwordHash: string }[] = [];
vi.mock('@/lib/db', () => ({ prisma: { user: { findMany: async () => users } } }));

import { findAccountsWithPublicPassword, SEED_DEV_PASSWORD } from '@/lib/security/public-passwords';

describe('public-passwords', () => {
  it('находит учётку с паролем сида и пропускает остальные', async () => {
    users.splice(
      0,
      users.length,
      { email: 'admin@test.local', passwordHash: hashSync(SEED_DEV_PASSWORD, 4) },
      { email: 'owner@example.com', passwordHash: hashSync('совсем-другой-пароль', 4) },
      { email: 'empty@example.com', passwordHash: '' }
    );
    expect(await findAccountsWithPublicPassword()).toEqual(['admin@test.local']);
  });

  it('нет совпадений — пустой список', async () => {
    users.splice(0, users.length, { email: 'a@b.c', passwordHash: hashSync('x', 4) });
    expect(await findAccountsWithPublicPassword()).toEqual([]);
  });
});
