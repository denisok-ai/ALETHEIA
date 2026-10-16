/**
 * Admin: включить/выключить сеть соцпубликаций. POST {enabled: boolean}.
 * Включение сбрасывает счётчик ошибок подряд и текст последней ошибки.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { setNetworkEnabled } from '@/lib/social/admin-apply';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { code } = await params;
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Ожидается enabled: boolean' }, { status: 400 });
  }
  const result = await setNetworkEnabled(code, body.enabled, auth.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
