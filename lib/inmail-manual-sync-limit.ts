import { NextResponse } from 'next/server';

const manualSyncAt = new Map<string, number>();
const COOLDOWN_MS = 45_000;

/** Ограничение частоты ручной синхронизации по ящику (in-memory). */
export function checkManualInmailSyncCooldown(mailboxId: string): NextResponse | null {
  const now = Date.now();
  const last = manualSyncAt.get(mailboxId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const sec = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: `Повторная синхронизация через ${sec} с` },
      { status: 429 }
    );
  }
  manualSyncAt.set(mailboxId, now);
  return null;
}
