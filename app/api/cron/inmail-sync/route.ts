/**
 * Cron: синхронизация всех включённых IMAP-ящиков (Входящие).
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledMailboxes } from '@/lib/inmail-sync';
import { getEnvOverrides } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const overrides = await getEnvOverrides();
  const secret = overrides.cron_secret;
  if (!secret) {
    return NextResponse.json(
      { error: 'Cron secret not configured. Set CRON_SECRET.' },
      { status: 503 }
    );
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
