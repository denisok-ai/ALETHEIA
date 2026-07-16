/**
 * Проверка Authorization: Bearer для cron-маршрутов.
 * Секрет: SystemSetting cron_secret (из CRON_SECRET) или process.env.CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEnvOverrides } from '@/lib/settings';
import { timingSafeStringEqual } from '@/lib/timing-safe';

export async function requireCronAuth(request: NextRequest): Promise<NextResponse | null> {
  const overrides = await getEnvOverrides();
  const secret = (overrides.cron_secret?.trim() || process.env.CRON_SECRET?.trim() || '');
  if (!secret) {
    return NextResponse.json(
      { error: 'Cron secret not configured. Set CRON_SECRET in .env or admin settings.' },
      { status: 503 }
    );
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!timingSafeStringEqual(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
