/**
 * Cron: сверка «оплачено, но доступа нет».
 * GET с заголовком Authorization: Bearer CRON_SECRET — см. docs/Env-Config.md.
 *
 * Страховочная сетка для платёжного контура: ловит расхождение независимо от
 * причины и не зависит от того, повторит ли PayKeeper доставку вебхука.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { markCronOk } from '@/lib/cron-heartbeat';
import { reconcileEnrollments } from '@/lib/payments/reconcile-enrollments';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export const dynamic = 'force-dynamic';

const ATTENTION_STATE_KEY = 'reconcile_attention_state';
/** Повтор тревоги об одних и тех же заказах — не чаще раза в сутки. */
const ATTENTION_REPEAT_MS = 24 * 60 * 60 * 1000;

/**
 * Слать ли тревогу: да, если состав проблемных заказов изменился или прошли
 * сутки с прошлого сообщения. Состояние — в SystemSetting, чтобы переживать
 * перезапуск приложения (иначе после каждого деплоя тревога шла бы заново).
 */
async function shouldNotifyAgain(key: string): Promise<boolean> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: ATTENTION_STATE_KEY } });
    const prev = row?.value ? (JSON.parse(row.value) as { key: string; at: string }) : null;
    const changed = prev?.key !== key;
    const stale = !prev || Date.now() - new Date(prev.at).getTime() >= ATTENTION_REPEAT_MS;
    if (!changed && !stale) return false;
    const value = JSON.stringify({ key, at: new Date().toISOString() });
    await prisma.systemSetting.upsert({
      where: { key: ATTENTION_STATE_KEY },
      update: { value },
      create: { key: ATTENTION_STATE_KEY, value, category: 'payments' },
    });
    return true;
  } catch (e) {
    // Сбой учёта не должен глушить тревогу — лучше лишнее сообщение, чем немое
    console.error('[reconcile] учёт тревог недоступен:', e);
    return true;
  }
}

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

    // Тревога о заказах, требующих ручной проверки, — не на каждый прогон.
    // Задача идёт каждые 10 минут, а такие заказы могут висеть неделями: без
    // ограничения админам шло бы по сообщению об одном и том же круглые сутки,
    // и тревоги перестали бы читать. Повторяем только если состав изменился
    // или прошло больше суток.
    const attentionKey = result.needsAttention
      .map((m) => m.orderNumber)
      .sort()
      .join(',');
    const shouldAlertAttention =
      result.needsAttention.length > 0 && (await shouldNotifyAgain(attentionKey));

    if (shouldAlertAttention) {
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

    await markCronOk('reconcile-enrollments');
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
