/**
 * Admin: действие над постом очереди. POST {action: 'requeue' | 'skip' | 'reschedule', scheduledAt?}.
 * requeue — только из failed; skip и reschedule — только из scheduled. «Опубликовать сейчас» нет намеренно:
 * это решение планировщика (лимит один пост в сеть за день).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { applyPostAction } from '@/lib/social/admin-apply';
import { isPostAction } from '@/lib/social/admin-actions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: rawId } = await params;
  const postId = Number(rawId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: 'Некорректный id поста' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown; scheduledAt?: unknown } | null;
  if (!isPostAction(body?.action)) {
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  }
  const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : undefined;
  const result = await applyPostAction(postId, { action: body.action, scheduledAt }, auth.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
