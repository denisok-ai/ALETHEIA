/**
 * Admin: append a fragment to the knowledge base (e.g. from resolved ticket).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getKnowledgeBase, setKnowledgeBase, clearKnowledgeBaseCache } from '@/lib/settings';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { fragment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const fragment = typeof body.fragment === 'string' ? body.fragment.trim() : '';
  if (!fragment) {
    return NextResponse.json({ error: 'Укажите fragment' }, { status: 400 });
  }
  if (fragment.length > 50000) {
    return NextResponse.json({ error: 'Фрагмент слишком длинный' }, { status: 400 });
  }

  const current = await getKnowledgeBase();
  const separator = current.endsWith('\n\n') || !current ? '' : '\n\n';
  const next = current + separator + '---\n\n' + fragment;
  await setKnowledgeBase(next);
  clearKnowledgeBaseCache();

  return NextResponse.json({ success: true });
}
