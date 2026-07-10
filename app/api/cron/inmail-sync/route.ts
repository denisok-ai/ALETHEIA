/**
 * Cron: синхронизация всех включённых IMAP-ящиков (Входящие).
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledMailboxes } from '@/lib/inmail-sync';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const results = await syncAllEnabledMailboxes();
  return NextResponse.json({
    processed: results.length,
    results: results.map((r) => ({
      mailboxId: r.mailboxId,
      ok: r.result.ok,
      imported: r.result.imported,
      error: r.result.error ?? null,
    })),
  });
}
