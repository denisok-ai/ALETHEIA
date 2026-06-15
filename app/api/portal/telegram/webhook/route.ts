/**
 * Telegram webhook route (legacy): бот на проде работает через long-polling worker.
 * Маршрут оставлен для совместимости nginx/health; обновления не обрабатываются.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    ok: true,
    mode: 'polling',
    note: 'Updates are handled by aletheia-telegram-poll.service (getUpdates).',
  });
}
