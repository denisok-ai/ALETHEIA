/**
 * Admin: проверка подключения к PayKeeper (текущий конфиг — боевой или тестовый).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { testPayKeeperConnection } from '@/lib/paykeeper';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await testPayKeeperConnection();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? 'Подключение не удалось' },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true });
}
