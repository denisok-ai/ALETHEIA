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
      notifyAdminsTelegramAsync('payment_needs_attention', [
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

    // Тревожим только там, где от админа реально что-то требуется: оплата есть,
    // а аккаунта под неё нет. Заказы с признаком намеренного отзыва доступа в
    // тревогу НЕ идут — по ним всё сделано осознанно и делать нечего, а они
    // остаются в выборке навсегда и давали бы ежедневное сообщение до скончания
    // времён. Видеть их можно в ответе маршрута (поле needsAttention) и в
    // отчёте `?repair=0`.
    const actionable = result.needsAttention.filter((m) => m.needsUser);

    // Даже по ним — не на каждый прогон: задача идёт каждые 10 минут, а заказ
    // может ждать разбора неделями. Повтор только при смене состава или раз в сутки.
    const attentionKey = actionable
      .map((m) => m.orderNumber)
      .sort()
      .join(',');
    const shouldAlertAttention = actionable.length > 0 && (await shouldNotifyAgain(attentionKey));

    if (shouldAlertAttention) {
      notifyAdminsTelegramAsync('payment_needs_attention', [
        `Оплачено, но выдать доступ некому: ${actionable.length}`,
        ...actionable.slice(0, 10).map((m) => `· ${m.orderNumber} — нет аккаунта для ${m.clientEmail}`),
        'Создайте аккаунт с этим email или свяжитесь с клиентом.',
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
