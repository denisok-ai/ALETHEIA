/**
 * Admin: get/update chatbot knowledge base (stored in SystemSetting, no longer from file).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { requireAdminSession } from '@/lib/auth';
import { getKnowledgeBase, setKnowledgeBase, clearKnowledgeBaseCache } from '@/lib/settings';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let content = await getKnowledgeBase();
  // Первый запуск: подтянуть из файла, если в БД пусто
  if (!content.trim()) {
    try {
      const filePath = path.join(process.cwd(), 'content', 'knowledge-base-body-never-lies.md');
      content = await readFile(filePath, 'utf-8');
      await setKnowledgeBase(content);
    } catch {
      // файла нет — оставляем пустую строку
    }
  }

  return NextResponse.json({ content });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content : '';
  await setKnowledgeBase(content);
  clearKnowledgeBaseCache();

  return NextResponse.json({ success: true });
}
