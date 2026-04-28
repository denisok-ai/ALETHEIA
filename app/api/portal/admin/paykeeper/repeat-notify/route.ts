/**
 * Admin: сброс счётчика оповещений PayKeeper (повтор webhook).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getPayKeeperConfigFromSettings, repeatPaymentNotification } from '@/lib/paykeeper';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cfg = await getPayKeeperConfigFromSettings();
  if (!cfg) return NextResponse.json({ error: 'PayKeeper не настроен' }, { status: 400 });

  let body: { paymentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  if (!paymentId) return NextResponse.json({ error: 'Укажите paymentId' }, { status: 400 });

  try {
    await repeatPaymentNotification(cfg, paymentId);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка repeatcnt';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
