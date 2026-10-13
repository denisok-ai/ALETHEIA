/**
 * Вебхук ЮKassa (HTTP-уведомления payment.succeeded, payment.canceled, refund.succeeded).
 * Адрес для кабинета ЮKassa: https://avaterra.pro/api/payments/yookassa/webhook
 *
 * Подписи у уведомлений нет: состояние платежа перечитывается через API (см. lib/yookassa/webhook.ts).
 * Опционально (yookassa_ip_check=1) отсекаем отправителей вне списка ЮKassa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/client-ip';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';
import { getYooKassaConfigFromSettings } from '@/lib/yookassa/config';
import { isYooKassaIp } from '@/lib/yookassa/ip';
import { handleYooKassaNotification } from '@/lib/yookassa/webhook';
import { buildYooKassaWebhookDeps } from '@/lib/yookassa/webhook-deps';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const cfg = await getYooKassaConfigFromSettings().catch(() => null);

  if (cfg?.ipCheck) {
    const ip = clientIpFromHeaders((name) => request.headers.get(name));
    if (!isYooKassaIp(ip)) {
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'yookassa.webhook.ip_rejected',
        status: 'error',
        message: `Уведомление с адреса вне списка ЮKassa: ${ip ?? 'адрес не определён'}`,
      }).catch(() => {});
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await handleYooKassaNotification(body, buildYooKassaWebhookDeps());
  return NextResponse.json(result.body, { status: result.status });
}
