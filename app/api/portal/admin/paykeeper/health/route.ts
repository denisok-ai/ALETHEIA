/**
 * Admin: диагностика PayKeeper (токен, системы, ошибки).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getPayKeeperConfigFromSettings, runPaykeeperHealthChecks } from '@/lib/paykeeper';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cfg = await getPayKeeperConfigFromSettings();
  if (!cfg) {
    return NextResponse.json({
      configured: false,
      checks: [
        {
          name: 'Конфигурация',
          ok: false,
          detail: 'PayKeeper не настроен в Портал → Настройки → Платежи',
        },
      ],
    });
  }

  const checks = await runPaykeeperHealthChecks(cfg);
  return NextResponse.json({ configured: true, server: cfg.server, checks });
}
