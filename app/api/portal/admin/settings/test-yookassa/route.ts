/**
 * Admin: проверка подключения к ЮKassa — GET /v3/me с сохранёнными реквизитами.
 * В ответе только идентификатор магазина и статус; секреты не возвращаются и не логируются.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { clearYooKassaConfigCache, getYooKassaConfigFromSettings } from '@/lib/yookassa/config';
import { fetchYooKassaAccount } from '@/lib/yookassa/client';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Сбрасываем кэш: проверяем именно то, что сейчас сохранено в настройках.
  clearYooKassaConfigCache();
  const cfg = await getYooKassaConfigFromSettings();
  if (!cfg) {
    return NextResponse.json({
      success: false,
      error: 'Не заданы shopId и секретный ключ для выбранного режима (боевой / тестовый).',
    });
  }

  try {
    const account = await fetchYooKassaAccount(cfg);
    return NextResponse.json({
      success: true,
      accountId: account.account_id,
      status: account.status ?? null,
      test: account.test ?? cfg.test,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Подключение не удалось';
    return NextResponse.json({ success: false, error: msg.slice(0, 300) });
  }
}
