/**
 * Только для instrumentation: чтение site_url из БД без React cache и без импорта encrypt/crypto
 * (иначе next build падает: webpack не резолвит `crypto` в графе instrumentation).
 */
import { prisma } from './db';
import { applyNextAuthUrlToProcessEnv } from './site-url';

export async function applyNextAuthUrlFromDatabaseStartup(): Promise<void> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ['site_url', 'nextauth_url'] } },
      select: { key: true, value: true },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const siteUrl = byKey.site_url?.trim() || process.env.NEXT_PUBLIC_URL?.trim() || '';
    const nextauthUrl = byKey.nextauth_url?.trim() || '';
    applyNextAuthUrlToProcessEnv({
      explicitNextAuthUrl: nextauthUrl || undefined,
      siteUrl: siteUrl || undefined,
    });
  } catch {
    /* БД недоступна при старте */
  }
}
