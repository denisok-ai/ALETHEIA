/**
 * Cron: сверка «оплачено, но доступа нет».
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 *
 * Страховочная сетка для платёжного контура: ловит расхождение независимо от
 * причины и не зависит от того, повторит ли PayKeeper доставку вебхука.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { reconcileEnrollments } from '@/lib/payments/reconcile-enrollments';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireCronAuth(request);
  if (authError) return authError;

  // repair=0 — только отчёт, без изменений (для ручной проверки перед выдачей).
  const repair = new URL(request.url).searchParams.get('repair') !== '0';

  try {
    const result = await reconcileEnrollments({ repair });

    if (result.repaired.length > 0) {
      const byNumber = new Map(result.missing.map((m) => [m.orderNumber, m]));
      notifyAdminsTelegramAsync('payment_received', [
        `Восстановлен доступ по оплаченным заказам: ${result.repaired.length}`,
        ...result.repaired.slice(0, 10).map((n) => {
          const m = byNumber.get(n);
          return `· ${n}${m ? ` — ${m.amount.toLocaleString('ru-RU')} ₽` : ''}`;
        }),
        'Заказ был оплачен, но зачисление не создалось — сверка это исправила.',
        'Проверьте, может ли клиент войти: если сбой случился до отправки письма, ' +
          'у него нет пароля, и доступ в БД сам по себе ему не поможет.',
      ]);
    }

    if (result.needsAttention.length > 0) {
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        `Оплачено без доступа, автоматически не чинится: ${result.needsAttention.length}`,
        ...result.needsAttention.slice(0, 10).map((m) =>
          m.needsUser
            ? `· ${m.orderNumber} — нет аккаунта для ${m.clientEmail}`
            : `· ${m.orderNumber} — похоже на намеренный отзыв доступа, не трогаем`
        ),
        'Заказы с отозванным доступом оставлены как есть. Остальным нужна ручная проверка.',
      ]);
    }

    return NextResponse.json({
      scanned: result.scanned,
      missing: result.missing.length,
      repaired: result.repaired.length,
      needsAttention: result.needsAttention.length,
      repairMode: repair,
    });
  } catch (e) {
    console.error('[cron reconcile-enrollments]', e);
    notifyAdminsTelegramAsync('paykeeper_webhook_error', [
      'Сверка зачислений не отработала.',
      `Ошибка: ${e instanceof Error ? e.message : String(e)}`,
    ]);
    return NextResponse.json({ error: 'reconcile failed' }, { status: 500 });
  }
}
