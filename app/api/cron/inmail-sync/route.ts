/**
 * Cron: синхронизация всех включённых IMAP-ящиков (Входящие).
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledMailboxes } from '@/lib/inmail-sync';
import { requireCronAuth } from '@/lib/cron-auth';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  const results = await syncAllEnabledMailboxes();
  const failed = results.filter((r) => !r.result.ok);
  const payload = {
    processed: results.length,
    failed: failed.length,
    results: results.map((r) => ({
      mailboxId: r.mailboxId,
      ok: r.result.ok,
      imported: r.result.imported,
      error: r.result.error ?? null,
    })),
  };
  // Отказ ящика раньше попадал только в тело ответа при коде 200: истёкший
  // пароль IMAP означал, что письма клиентов молча перестают импортироваться,
  // а лог cron оставался зелёным — узнавали через недели по жалобам.
  if (failed.length > 0) {
    notifyAdminsTelegramAsync('support_ticket', [
      `Синхронизация почты: ошибок ${failed.length} из ${results.length}`,
      ...failed.slice(0, 5).map((r) => `· ящик ${r.mailboxId}: ${r.result.error ?? 'неизвестно'}`),
    ]);
    return NextResponse.json(payload, { status: 500 });
  }
  return NextResponse.json(payload);
}
