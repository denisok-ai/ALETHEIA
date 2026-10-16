/**
 * Admin: пауза всех сетей соцпубликаций (SocialRule paused_all). POST {paused: boolean}.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { setPauseAll } from '@/lib/social/admin-apply';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { paused?: unknown } | null;
  if (typeof body?.paused !== 'boolean') {
    return NextResponse.json({ error: 'Ожидается paused: boolean' }, { status: 400 });
  }
  const result = await setPauseAll(body.paused, auth.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, paused: body.paused });
}
