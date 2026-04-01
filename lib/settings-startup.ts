/**
 * Только для instrumentation: чтение site_url из БД без React cache и без импорта encrypt/crypto
 * (иначе next build падает: webpack не резолвит `crypto` в графе instrumentation).
 */
import { prisma } from './db';
import { applyNextAuthUrlToProcessEnv } from './site-url';

export async function applyNextAuthUrlFromDatabaseStartup(): Promise<void> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: 'site_url' },
      select: { value: true },
    });
    const siteUrl = row?.value?.trim() || process.env.NEXT_PUBLIC_URL?.trim() || '';
    applyNextAuthUrlToProcessEnv({ siteUrl: siteUrl || undefined });
  } catch {
    /* БД недоступна при старте */
  }
}
