/**
 * Admin: get recent LLM request log (in-memory, last 50 entries).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getLlmRequestLog } from '@/lib/llm-request-log';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const entries = getLlmRequestLog(50);
  return NextResponse.json({ entries });
}
