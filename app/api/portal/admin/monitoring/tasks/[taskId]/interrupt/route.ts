/**
 * Admin: прервать фоновую задачу (устанавливает флаг; задача должна проверять и завершаться).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getActiveTasks, setInterrupted } from '@/lib/background-tasks';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { taskId } = await params;
  const active = getActiveTasks();
  const task = active.find((t) => t.id === taskId);
  if (!task) {
    return NextResponse.json({ error: 'Task not found or already finished' }, { status: 404 });
  }

  setInterrupted(taskId);
  return NextResponse.json({ ok: true });
}
